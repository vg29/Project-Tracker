import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const PORT = Number(process.env.PORT) || 3000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const KEY_PREFIX = 'aai-desk/';

interface R2Config {
  client: S3Client;
  bucket: string;
  publicUrl: string;
}

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
  const bucket = process.env.R2_BUCKET_NAME?.trim() ?? '';
  const customEndpoint = process.env.R2_ENDPOINT?.trim() ?? '';
  const publicUrl = (process.env.R2_PUBLIC_URL?.trim() ?? '').replace(/\/+$/, '');

  const endpoint =
    customEndpoint ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { client, bucket, publicUrl };
}

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function formatTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isValidR2Key(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.startsWith(KEY_PREFIX) &&
    !key.includes('..') &&
    key.length > KEY_PREFIX.length
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/r2/upload', (req: Request, res: Response) => {
    upload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (
          uploadErr instanceof multer.MulterError &&
          uploadErr.code === 'LIMIT_FILE_SIZE'
        ) {
          res.status(413).json({
            error: 'File exceeds the 25 MB upload limit.',
          });
          return;
        }
        res.status(400).json({
          error:
            uploadErr instanceof Error
              ? uploadErr.message
              : 'Failed to parse uploaded file.',
        });
        return;
      }

      const r2 = getR2Config();
      if (!r2) {
        res.status(503).json({
          error:
            'Cloudflare R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in environment secrets.',
        });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file provided for upload.' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const userId = sanitizeSegment(
        typeof body.userId === 'string' ? body.userId : '',
        'executive'
      );
      const projectId = sanitizeSegment(
        typeof body.projectId === 'string' ? body.projectId : '',
        'general'
      );
      const slotKey = sanitizeSegment(
        typeof body.slotKey === 'string' ? body.slotKey : '',
        'document'
      );
      const safeFileName = sanitizeSegment(file.originalname, 'document');
      const r2Key = `${KEY_PREFIX}${userId}/${projectId}/${slotKey}-${Date.now()}-${safeFileName}`;

      try {
        await r2.client.send(
          new PutObjectCommand({
            Bucket: r2.bucket,
            Key: r2Key,
            Body: file.buffer,
            ContentType: file.mimetype || 'application/octet-stream',
            Metadata: {
              originalname: encodeURIComponent(file.originalname),
            },
          })
        );

        const proxyUrl = `/api/r2/file?key=${encodeURIComponent(r2Key)}&name=${encodeURIComponent(file.originalname)}`;

        res.status(201).json({
          storageProvider: 'r2',
          r2Key,
          fileName: file.originalname,
          fileType: file.mimetype || 'application/octet-stream',
          fileSize: file.size,
          uploadedAt: formatTodayISO(),
          url: proxyUrl,
        });
      } catch (err) {
        console.error('Cloudflare R2 upload error:', err);
        res.status(502).json({
          error:
            err instanceof Error
              ? `Cloudflare R2 upload failed: ${err.message}`
              : 'Cloudflare R2 upload failed.',
        });
      }
    });
  });

  app.get('/api/r2/file', async (req: Request, res: Response) => {
    const r2 = getR2Config();
    if (!r2) {
      res.status(503).json({
        error: 'Cloudflare R2 storage is not configured.',
      });
      return;
    }

    const key = typeof req.query.key === 'string' ? req.query.key : '';
    const requestedName =
      typeof req.query.name === 'string' ? req.query.name : '';

    if (!isValidR2Key(key)) {
      res.status(400).json({ error: 'Invalid file key.' });
      return;
    }

    try {
      const output = await r2.client.send(
        new GetObjectCommand({
          Bucket: r2.bucket,
          Key: key,
        })
      );

      const fallbackName = path.basename(key);
      const downloadName = (requestedName || fallbackName).replace(/["\r\n]/g, '_');

      res.setHeader(
        'Content-Type',
        output.ContentType || 'application/octet-stream'
      );
      if (typeof output.ContentLength === 'number') {
        res.setHeader('Content-Length', String(output.ContentLength));
      }
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(
          requestedName || fallbackName
        )}`
      );
      res.setHeader('Cache-Control', 'private, max-age=300');

      if (!output.Body) {
        res.status(404).json({ error: 'File body not found.' });
        return;
      }

      if (output.Body instanceof Readable) {
        output.Body.pipe(res);
      } else {
        const bytes = await output.Body.transformToByteArray();
        res.send(Buffer.from(bytes));
      }
    } catch (err) {
      console.error('Cloudflare R2 download error:', err);
      res.status(404).json({
        error: 'Could not retrieve file from Cloudflare R2.',
      });
    }
  });

  app.delete('/api/r2/file', async (req: Request, res: Response) => {
    const r2 = getR2Config();
    if (!r2) {
      res.status(503).json({
        error: 'Cloudflare R2 storage is not configured.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const key = typeof body.key === 'string' ? body.key : '';
    if (!isValidR2Key(key)) {
      res.status(400).json({ error: 'Invalid file key.' });
      return;
    }

    try {
      await r2.client.send(
        new DeleteObjectCommand({
          Bucket: r2.bucket,
          Key: key,
        })
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error('Cloudflare R2 delete error:', err);
      res.status(502).json({
        error: 'Failed to delete file from Cloudflare R2.',
      });
    }
  });

  app.post('/api/r2/delete-batch', async (req: Request, res: Response) => {
    const r2 = getR2Config();
    if (!r2) {
      res.status(503).json({
        error: 'Cloudflare R2 storage is not configured.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawKeys = Array.isArray(body.keys) ? body.keys : [];
    const validKeys = rawKeys.filter(
      (k): k is string => typeof k === 'string' && isValidR2Key(k)
    );

    if (validKeys.length === 0) {
      res.json({ deleted: 0 });
      return;
    }

    try {
      await r2.client.send(
        new DeleteObjectsCommand({
          Bucket: r2.bucket,
          Delete: {
            Objects: validKeys.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
      res.json({ deleted: validKeys.length });
    } catch (err) {
      console.error('Cloudflare R2 batch delete error:', err);
      res.status(502).json({
        error: 'Failed to delete files from Cloudflare R2.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response, next: NextFunction) => {
      if (_req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
