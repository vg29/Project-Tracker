import 'dotenv/config';
import crypto from 'crypto';
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

const DESIGNATION_OPTIONS = [
  'Junior Executive(IT)',
  'Assistant Manager(IT)',
  'Manager(IT)',
] as const;

const DEFAULT_DESIGNATION = DESIGNATION_OPTIONS[1];

const DEFAULT_PROFILE = {
  name: 'Raghav Verma',
  designation: DEFAULT_DESIGNATION,
  station: 'VIDP · Terminal 3',
  employeeId: 'AAI-IT-4182',
};

const DEFAULT_PROJECTS = [
  {
    id: 'proj-runway',
    name: 'Runway & Apron Lighting Inspection',
    code: 'OPS-RWY-12',
    division: 'Airside Operations',
    createdAt: '2026-10-14',
  },
  {
    id: 'proj-dgca',
    name: 'DGCA Quarterly Safety Audit',
    code: 'SAF-DGCA-04',
    division: 'Safety & Compliance',
    createdAt: '2026-10-20',
  },
  {
    id: 'proj-baggage',
    name: 'Baggage Handling System Check',
    code: 'TRM-BHS-09',
    division: 'Terminal Management',
    createdAt: '2026-11-01',
  },
  {
    id: 'proj-signage',
    name: 'Passenger Wayfinding Signage Refresh',
    code: 'TRM-WAY-03',
    division: 'Passenger Facilitation',
    createdAt: '2026-11-05',
  },
];

const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Submit weekly runway friction & rubber deposit log',
    projectId: 'proj-runway',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: '2026-11-17',
    refNo: 'AAI/OPS/26/114',
    notes:
      'Verify Mu-meter calibration sheet with Airside Shift Supervisor before uploading to station folder.',
    createdAt: '2026-11-12',
    completedAt: null,
  },
  {
    id: 'task-2',
    title: 'Compile apron floodlight outage register for Electrical wing',
    projectId: 'proj-runway',
    status: 'todo',
    priority: 'priority',
    dueDate: '2026-11-19',
    refNo: 'AAI/OPS/26/118',
    notes: 'Bay 14 and Bay 22 masts flagged during night inspection.',
    createdAt: '2026-11-14',
    completedAt: null,
  },
  {
    id: 'task-3',
    title: 'Cross-check fire extinguisher pressure tags across Pier B',
    projectId: 'proj-dgca',
    status: 'in_progress',
    priority: 'priority',
    dueDate: '2026-11-18',
    refNo: 'AAI/SAF/26/042',
    notes: 'Coordinate with AAI Fire Service duty officer for final sign-off.',
    createdAt: '2026-11-10',
    completedAt: null,
  },
  {
    id: 'task-4',
    title: 'Prepare DGCA compliance annexure for wildlife hazard log',
    projectId: 'proj-dgca',
    status: 'todo',
    priority: 'routine',
    dueDate: '2026-11-23',
    refNo: 'AAI/SAF/26/049',
    notes: 'Include October bird-strike prevention patrol summary.',
    createdAt: '2026-11-15',
    completedAt: null,
  },
  {
    id: 'task-5',
    title: 'Follow up with AMC vendor on Conveyor Belt 4 sensor calibration',
    projectId: 'proj-baggage',
    status: 'todo',
    priority: 'urgent',
    dueDate: '2026-11-15',
    refNo: 'AAI/TRM/26/207',
    notes: 'Vendor technician scheduled for 06:00 IST maintenance window.',
    createdAt: '2026-11-11',
    completedAt: null,
  },
  {
    id: 'task-6',
    title: 'Walkthrough arrival belt signage visibility near Gate 7',
    projectId: 'proj-signage',
    status: 'todo',
    priority: 'routine',
    dueDate: '2026-11-25',
    refNo: 'AAI/TRM/26/212',
    notes:
      'Check bilingual Hindi/English lettering alignment after backlighting replacement.',
    createdAt: '2026-11-16',
    completedAt: null,
  },
  {
    id: 'task-7',
    title: 'File monthly bird-scaring cartridge inventory sheet',
    projectId: 'proj-dgca',
    status: 'done',
    priority: 'routine',
    dueDate: '2026-11-10',
    refNo: 'AAI/SAF/26/031',
    notes: 'Signed and archived in Station Director binder.',
    createdAt: '2026-11-04',
    completedAt: '2026-11-09',
  },
  {
    id: 'task-8',
    title: 'Verify emergency exit illumination backup battery test',
    projectId: 'proj-baggage',
    status: 'done',
    priority: 'priority',
    dueDate: '2026-11-12',
    refNo: 'AAI/TRM/26/194',
    notes: '90-minute load test passed across Domestic Arrivals.',
    createdAt: '2026-11-06',
    completedAt: '2026-11-12',
  },
];

interface R2Config {
  client: S3Client;
  bucket: string;
}

interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  designation: string;
  station: string;
  employeeId: string;
  createdAt: string;
}

interface D1UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  name: string;
  designation: string;
  station: string;
  employee_id: string;
  created_at: string;
}

interface D1ProjectRow {
  id: string;
  user_id: string;
  name: string;
  code: string;
  division: string;
  created_at: string;
}

interface D1DocumentRow {
  id: string;
  user_id: string;
  project_id: string;
  slot_key: string;
  label: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  storage_provider: string;
  r2_key: string | null;
  url: string | null;
}

interface D1TaskRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'routine' | 'priority' | 'urgent';
  due_date: string;
  ref_no: string;
  notes: string;
  created_at: string;
  completed_at: string | null;
  archived: number;
  archived_at: string | null;
}

interface AuthedRequest extends Request {
  authUser?: PublicUser;
  authToken?: string;
}

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
  const bucket = process.env.R2_BUCKET_NAME?.trim() ?? '';
  const customEndpoint = process.env.R2_ENDPOINT?.trim() ?? '';

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

  return { client, bucket };
}

function getD1Config(): D1Config | null {
  const accountId =
    process.env.D1_ACCOUNT_ID?.trim() ||
    process.env.R2_ACCOUNT_ID?.trim() ||
    '';
  const databaseId = process.env.D1_DATABASE_ID?.trim() ?? '';
  const apiToken =
    process.env.D1_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    '';

  if (!accountId || !databaseId || !apiToken) {
    return null;
  }

  return { accountId, databaseId, apiToken };
}

class D1NotConfiguredError extends Error {
  constructor() {
    super(
      'Cloudflare D1 database is not configured. Set D1_ACCOUNT_ID (or R2_ACCOUNT_ID), D1_DATABASE_ID, and D1_API_TOKEN in environment secrets.'
    );
    this.name = 'D1NotConfiguredError';
  }
}

function normalizeSqlParam(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return String(value);
}

interface D1RestResponse<T> {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: {
    success?: boolean;
    results?: T[];
  }[];
}

async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const cfg = getD1Config();
  if (!cfg) {
    throw new D1NotConfiguredError();
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    cfg.accountId
  )}/d1/database/${encodeURIComponent(cfg.databaseId)}/query`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params: params.map(normalizeSqlParam),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | D1RestResponse<T>
    | null;

  if (!response.ok || !payload || !payload.success) {
    const errMsg =
      payload?.errors?.[0]?.message ||
      `Cloudflare D1 query failed with status ${response.status}.`;
    throw new Error(errMsg);
  }

  const firstResult = payload.result?.[0];
  if (firstResult && firstResult.success === false) {
    throw new Error('Cloudflare D1 SQL execution failed.');
  }

  return firstResult?.results ?? [];
}

let d1ReadyPromise: Promise<void> | null = null;

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  const candidate = hashPassword(password, salt);
  const candidateBuf = Buffer.from(candidate, 'utf8');
  const expectedBuf = Buffer.from(expectedHash, 'utf8');
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

function normalizeDesignation(value?: string | null): string {
  if (!value) return DEFAULT_DESIGNATION;
  if (value === 'Assistant Manager (IT)') return 'Assistant Manager(IT)';
  if ((DESIGNATION_OPTIONS as readonly string[]).includes(value)) {
    return value;
  }
  return DEFAULT_DESIGNATION;
}

function formatTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function seedDefaultProjectAndTasksForUser(userId: string): Promise<void> {
  for (const project of DEFAULT_PROJECTS) {
    const projectId = `${userId}::${project.id}`;
    await d1Query(
      `INSERT OR IGNORE INTO projects (id, user_id, name, code, division, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        userId,
        project.name,
        project.code,
        project.division,
        project.createdAt,
      ]
    );
  }

  for (const task of DEFAULT_TASKS) {
    const taskId = `${userId}::${task.id}`;
    const projectId = task.projectId ? `${userId}::${task.projectId}` : '';
    await d1Query(
      `INSERT OR IGNORE INTO tasks (
        id, user_id, project_id, title, status, priority, due_date,
        ref_no, notes, created_at, completed_at, archived, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        taskId,
        userId,
        projectId,
        task.title,
        task.status,
        task.priority,
        task.dueDate,
        task.refNo,
        task.notes,
        task.createdAt,
        task.completedAt,
      ]
    );
  }
}

async function ensureD1Ready(): Promise<void> {
  if (!getD1Config()) {
    throw new D1NotConfiguredError();
  }

  if (d1ReadyPromise) {
    return d1ReadyPromise;
  }

  d1ReadyPromise = (async () => {
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        station TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        division TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)`,
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        slot_key TEXT NOT NULL,
        label TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL,
        storage_provider TEXT NOT NULL,
        r2_key TEXT,
        url TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date TEXT NOT NULL,
        ref_no TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id)`,
    ];

    for (const sql of schemaStatements) {
      await d1Query(sql);
    }

    const countRows = await d1Query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM users`
    );
    const totalUsers = Number(countRows[0]?.total ?? 0);

    if (totalUsers === 0) {
      const defaultUserId = 'user-raghav-it';
      const salt = generateSalt();
      const passwordHash = hashPassword('AAI@2026', salt);

      await d1Query(
        `INSERT OR IGNORE INTO users (
          id, email, password_hash, salt, name, designation, station, employee_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          defaultUserId,
          'raghav.it@aai.aero',
          passwordHash,
          salt,
          DEFAULT_PROFILE.name,
          DEFAULT_DESIGNATION,
          DEFAULT_PROFILE.station,
          DEFAULT_PROFILE.employeeId,
          formatTodayISO(),
        ]
      );

      await seedDefaultProjectAndTasksForUser(defaultUserId);
    }
  })();

  try {
    await d1ReadyPromise;
  } catch (err) {
    d1ReadyPromise = null;
    throw err;
  }
}

function toPublicUser(row: D1UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    designation: normalizeDesignation(row.designation),
    station: row.station,
    employeeId: row.employee_id,
    createdAt: row.created_at,
  };
}

async function createSessionForUser(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await d1Query(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    [token, userId, now.toISOString(), expires.toISOString()]
  );
  return token;
}

function getBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

async function getSessionUserByToken(token: string): Promise<PublicUser | null> {
  if (!token) return null;
  await ensureD1Ready();
  const rows = await d1Query<D1UserRow>(
    `SELECT u.* FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?
     LIMIT 1`,
    [token, new Date().toISOString()]
  );
  const row = rows[0];
  return row ? toPublicUser(row) : null;
}

async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = getBearerToken(req);
    const user = await getSessionUserByToken(token);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    req.authUser = user;
    req.authToken = token;
    next();
  } catch (err) {
    handleApiError(res, err);
  }
}

function handleApiError(res: Response, err: unknown): void {
  if (err instanceof D1NotConfiguredError) {
    res.status(503).json({ error: err.message });
    return;
  }
  console.error('API error:', err);
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Internal server error.',
  });
}

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function isValidR2Key(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.startsWith(KEY_PREFIX) &&
    !key.includes('..') &&
    key.length > KEY_PREFIX.length
  );
}

async function deleteR2KeysBestEffort(keys: (string | null | undefined)[]): Promise<void> {
  const validKeys = keys.filter((k): k is string => Boolean(k && isValidR2Key(k)));
  if (validKeys.length === 0) return;
  const r2 = getR2Config();
  if (!r2) return;

  try {
    if (validKeys.length === 1) {
      await r2.client.send(
        new DeleteObjectCommand({
          Bucket: r2.bucket,
          Key: validKeys[0],
        })
      );
    } else {
      await r2.client.send(
        new DeleteObjectsCommand({
          Bucket: r2.bucket,
          Delete: {
            Objects: validKeys.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }
  } catch (err) {
    console.warn('Cloudflare R2 cleanup failed:', err);
  }
}

interface IncomingFilePayload {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  storageProvider?: string;
  r2Key?: string;
  url?: string;
}

function mapDocumentRowToProjectFile(row: D1DocumentRow): IncomingFilePayload {
  return {
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size),
    uploadedAt: row.uploaded_at,
    storageProvider: row.storage_provider === 'local' ? 'local' : 'r2',
    r2Key: row.r2_key ?? undefined,
    url: row.url ?? undefined,
  };
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

  // =========================================================================
  // Auth & Session Endpoints (Cloudflare D1)
  // =========================================================================

  app.get('/api/auth/session', async (req: Request, res: Response) => {
    try {
      const token = getBearerToken(req);
      const user = await getSessionUserByToken(token);
      res.json({ user });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      await ensureD1Ready();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const identifier =
        typeof body.identifier === 'string'
          ? body.identifier.trim().toLowerCase()
          : '';
      const password =
        typeof body.password === 'string' ? body.password : '';

      if (!identifier || !password) {
        res.status(400).json({
          error: 'Please enter both your email / employee ID and password.',
        });
        return;
      }

      const rows = await d1Query<D1UserRow>(
        `SELECT * FROM users
         WHERE LOWER(email) = ? OR (employee_id != '' AND LOWER(employee_id) = ?)
         LIMIT 1`,
        [identifier, identifier]
      );

      const userRow = rows[0];
      if (!userRow) {
        res.status(401).json({
          error: 'No account found with that email or employee ID.',
        });
        return;
      }

      if (!verifyPassword(password, userRow.salt, userRow.password_hash)) {
        res.status(401).json({
          error: 'Incorrect password. Please try again.',
        });
        return;
      }

      const token = await createSessionForUser(userRow.id);
      res.json({ token, user: toPublicUser(userRow) });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      await ensureD1Ready();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email =
        typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const designation = normalizeDesignation(
        typeof body.designation === 'string' ? body.designation : ''
      );
      const station =
        (typeof body.station === 'string' ? body.station.trim() : '') ||
        'AAI Station';
      const employeeId =
        typeof body.employeeId === 'string'
          ? body.employeeId.trim().toUpperCase()
          : '';
      const password =
        typeof body.password === 'string' ? body.password : '';

      if (!name || !email || !password) {
        res.status(400).json({
          error: 'Full name, email, and password are required.',
        });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({
          error: 'Password must be at least 6 characters.',
        });
        return;
      }

      const existing = await d1Query<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`,
        [email]
      );
      if (existing.length > 0) {
        res.status(409).json({
          error: 'An account with this email already exists.',
        });
        return;
      }

      const userId = `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);
      const createdAt = formatTodayISO();

      await d1Query(
        `INSERT INTO users (
          id, email, password_hash, salt, name, designation, station, employee_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          email,
          passwordHash,
          salt,
          name,
          designation,
          station,
          employeeId,
          createdAt,
        ]
      );

      await seedDefaultProjectAndTasksForUser(userId);
      const token = await createSessionForUser(userId);

      res.status(201).json({
        token,
        user: {
          id: userId,
          email,
          name,
          designation,
          station,
          employeeId,
          createdAt,
        } satisfies PublicUser,
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const token = getBearerToken(req);
      if (token && getD1Config()) {
        await ensureD1Ready();
        await d1Query(`DELETE FROM sessions WHERE token = ?`, [token]);
      }
      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // =========================================================================
  // Workspace, Profile, Projects, Documents & Tasks (Cloudflare D1)
  // =========================================================================

  app.get('/api/workspace', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const [projectRows, docRows, taskRows] = await Promise.all([
        d1Query<D1ProjectRow>(
          `SELECT * FROM projects WHERE user_id = ? ORDER BY created_at ASC`,
          [user.id]
        ),
        d1Query<D1DocumentRow>(
          `SELECT * FROM documents WHERE user_id = ?`,
          [user.id]
        ),
        d1Query<D1TaskRow>(
          `SELECT * FROM tasks WHERE user_id = ?`,
          [user.id]
        ),
      ]);

      const docsByProject: Record<
        string,
        {
          rfp?: IncomingFilePayload;
          eOfficeFile?: IncomingFilePayload;
          agreement?: IncomingFilePayload;
          purchaseOrder?: IncomingFilePayload;
          bg?: IncomingFilePayload;
          ip?: IncomingFilePayload;
          bills?: IncomingFilePayload;
          otherDocuments: {
            id: string;
            label: string;
            file: IncomingFilePayload;
          }[];
        }
      > = {};

      for (const docRow of docRows) {
        if (!docsByProject[docRow.project_id]) {
          docsByProject[docRow.project_id] = { otherDocuments: [] };
        }
        const bucket = docsByProject[docRow.project_id];
        const fileObj = mapDocumentRowToProjectFile(docRow);
        if (docRow.slot_key === 'custom') {
          bucket.otherDocuments.push({
            id: docRow.id,
            label: docRow.label,
            file: fileObj,
          });
        } else if (
          docRow.slot_key === 'rfp' ||
          docRow.slot_key === 'eOfficeFile' ||
          docRow.slot_key === 'agreement' ||
          docRow.slot_key === 'purchaseOrder' ||
          docRow.slot_key === 'bg' ||
          docRow.slot_key === 'ip' ||
          docRow.slot_key === 'bills'
        ) {
          bucket[docRow.slot_key] = fileObj;
        }
      }

      const projects = projectRows.map((p) => {
        const docs = docsByProject[p.id];
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          division: p.division,
          createdAt: p.created_at,
          rfp: docs?.rfp,
          eOfficeFile: docs?.eOfficeFile,
          agreement: docs?.agreement,
          purchaseOrder: docs?.purchaseOrder,
          bg: docs?.bg,
          ip: docs?.ip,
          bills: docs?.bills,
          otherDocuments: docs?.otherDocuments ?? [],
        };
      });

      const tasks = taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.project_id,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        refNo: t.ref_no,
        notes: t.notes,
        createdAt: t.created_at,
        completedAt: t.completed_at ?? undefined,
        archived: Boolean(t.archived),
        archivedAt: t.archived_at ?? undefined,
      }));

      res.json({
        profile: {
          name: user.name,
          designation: user.designation,
          station: user.station,
          employeeId: user.employeeId,
        },
        projects,
        tasks,
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put('/api/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name =
        (typeof body.name === 'string' ? body.name.trim() : '') || user.name;
      const designation = normalizeDesignation(
        typeof body.designation === 'string' ? body.designation : user.designation
      );
      const station =
        (typeof body.station === 'string' ? body.station.trim() : '') ||
        'AAI Station';
      const employeeId =
        typeof body.employeeId === 'string'
          ? body.employeeId.trim()
          : user.employeeId;

      await d1Query(
        `UPDATE users SET name = ?, designation = ?, station = ?, employee_id = ? WHERE id = ?`,
        [name, designation, station, employeeId, user.id]
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/workspace/reset', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const docRows = await d1Query<{ r2_key: string | null }>(
        `SELECT r2_key FROM documents WHERE user_id = ?`,
        [user.id]
      );

      await d1Query(`DELETE FROM documents WHERE user_id = ?`, [user.id]);
      await d1Query(`DELETE FROM tasks WHERE user_id = ?`, [user.id]);
      await d1Query(`DELETE FROM projects WHERE user_id = ?`, [user.id]);
      await seedDefaultProjectAndTasksForUser(user.id);

      await deleteR2KeysBestEffort(docRows.map((d) => d.r2_key));
      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/projects', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const division =
        typeof body.division === 'string' ? body.division.trim() : '';
      const purchaseOrder = body.purchaseOrder as IncomingFilePayload | undefined;

      if (!name) {
        res.status(400).json({ error: 'Project name is required.' });
        return;
      }

      const projectId = `${user.id}::proj-${Date.now()}`;
      const createdAt = formatTodayISO();

      await d1Query(
        `INSERT INTO projects (id, user_id, name, code, division, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, user.id, name, code, division, createdAt]
      );

      if (purchaseOrder) {
        await d1Query(
          `INSERT OR REPLACE INTO documents (
            id, user_id, project_id, slot_key, label, file_name, file_type,
            file_size, uploaded_at, storage_provider, r2_key, url
          ) VALUES (?, ?, ?, 'purchaseOrder', 'PO', ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${projectId}::purchaseOrder`,
            user.id,
            projectId,
            purchaseOrder.fileName,
            purchaseOrder.fileType || 'application/octet-stream',
            Number(purchaseOrder.fileSize) || 0,
            purchaseOrder.uploadedAt || createdAt,
            purchaseOrder.storageProvider || 'r2',
            purchaseOrder.r2Key ?? null,
            purchaseOrder.url ?? null,
          ]
        );
      }

      res.status(201).json({ id: projectId });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put('/api/projects/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const projectId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const division =
        typeof body.division === 'string' ? body.division.trim() : '';
      const purchaseOrder = body.purchaseOrder as IncomingFilePayload | undefined;

      const existingRows = await d1Query<D1ProjectRow>(
        `SELECT * FROM projects WHERE id = ? AND user_id = ? LIMIT 1`,
        [projectId, user.id]
      );
      if (existingRows.length === 0) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      await d1Query(
        `UPDATE projects SET name = ?, code = ?, division = ? WHERE id = ? AND user_id = ?`,
        [name, code, division, projectId, user.id]
      );

      const poDocId = `${projectId}::purchaseOrder`;
      const existingPoRows = await d1Query<{ r2_key: string | null }>(
        `SELECT r2_key FROM documents WHERE id = ? AND user_id = ? LIMIT 1`,
        [poDocId, user.id]
      );
      const oldR2Key = existingPoRows[0]?.r2_key ?? null;

      if (purchaseOrder) {
        await d1Query(
          `INSERT OR REPLACE INTO documents (
            id, user_id, project_id, slot_key, label, file_name, file_type,
            file_size, uploaded_at, storage_provider, r2_key, url
          ) VALUES (?, ?, ?, 'purchaseOrder', 'PO', ?, ?, ?, ?, ?, ?, ?)`,
          [
            poDocId,
            user.id,
            projectId,
            purchaseOrder.fileName,
            purchaseOrder.fileType || 'application/octet-stream',
            Number(purchaseOrder.fileSize) || 0,
            purchaseOrder.uploadedAt || formatTodayISO(),
            purchaseOrder.storageProvider || 'r2',
            purchaseOrder.r2Key ?? null,
            purchaseOrder.url ?? null,
          ]
        );
      } else {
        await d1Query(
          `DELETE FROM documents WHERE id = ? AND user_id = ?`,
          [poDocId, user.id]
        );
      }

      if (oldR2Key && oldR2Key !== purchaseOrder?.r2Key) {
        await deleteR2KeysBestEffort([oldR2Key]);
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete('/api/projects/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const projectId = String(req.params.id ?? '');

      const docRows = await d1Query<{ r2_key: string | null }>(
        `SELECT r2_key FROM documents WHERE project_id = ? AND user_id = ?`,
        [projectId, user.id]
      );

      await d1Query(
        `DELETE FROM documents WHERE project_id = ? AND user_id = ?`,
        [projectId, user.id]
      );
      await d1Query(
        `UPDATE tasks SET project_id = '' WHERE project_id = ? AND user_id = ?`,
        [projectId, user.id]
      );
      await d1Query(
        `DELETE FROM projects WHERE id = ? AND user_id = ?`,
        [projectId, user.id]
      );

      await deleteR2KeysBestEffort(docRows.map((d) => d.r2_key));
      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put(
    '/api/projects/:id/documents/core/:slotKey',
    requireAuth,
    async (req: AuthedRequest, res: Response) => {
      try {
        const user = req.authUser!;
        const projectId = String(req.params.id ?? '');
        const slotKey = String(req.params.slotKey ?? '');
        const body = (req.body ?? {}) as Record<string, unknown>;
        const label = typeof body.label === 'string' ? body.label.trim() : slotKey;
        const file = body.file as IncomingFilePayload | undefined;

        if (!file) {
          res.status(400).json({ error: 'Document metadata is required.' });
          return;
        }

        const docId = `${projectId}::${slotKey}`;
        const existingRows = await d1Query<{ r2_key: string | null }>(
          `SELECT r2_key FROM documents WHERE id = ? AND user_id = ? LIMIT 1`,
          [docId, user.id]
        );
        const oldR2Key = existingRows[0]?.r2_key ?? null;

        await d1Query(
          `INSERT OR REPLACE INTO documents (
            id, user_id, project_id, slot_key, label, file_name, file_type,
            file_size, uploaded_at, storage_provider, r2_key, url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docId,
            user.id,
            projectId,
            slotKey,
            label,
            file.fileName,
            file.fileType || 'application/octet-stream',
            Number(file.fileSize) || 0,
            file.uploadedAt || formatTodayISO(),
            file.storageProvider || 'r2',
            file.r2Key ?? null,
            file.url ?? null,
          ]
        );

        if (oldR2Key && oldR2Key !== file.r2Key) {
          await deleteR2KeysBestEffort([oldR2Key]);
        }

        res.json({ ok: true });
      } catch (err) {
        handleApiError(res, err);
      }
    }
  );

  app.delete(
    '/api/projects/:id/documents/core/:slotKey',
    requireAuth,
    async (req: AuthedRequest, res: Response) => {
      try {
        const user = req.authUser!;
        const projectId = String(req.params.id ?? '');
        const slotKey = String(req.params.slotKey ?? '');
        const docId = `${projectId}::${slotKey}`;

        const existingRows = await d1Query<{ r2_key: string | null }>(
          `SELECT r2_key FROM documents WHERE id = ? AND user_id = ? LIMIT 1`,
          [docId, user.id]
        );

        await d1Query(
          `DELETE FROM documents WHERE id = ? AND user_id = ?`,
          [docId, user.id]
        );

        await deleteR2KeysBestEffort([existingRows[0]?.r2_key]);
        res.json({ ok: true });
      } catch (err) {
        handleApiError(res, err);
      }
    }
  );

  app.post(
    '/api/projects/:id/documents/custom',
    requireAuth,
    async (req: AuthedRequest, res: Response) => {
      try {
        const user = req.authUser!;
        const projectId = String(req.params.id ?? '');
        const body = (req.body ?? {}) as Record<string, unknown>;
        const label = typeof body.label === 'string' ? body.label.trim() : '';
        const file = body.file as IncomingFilePayload | undefined;

        if (!label || !file) {
          res.status(400).json({ error: 'Document label and metadata are required.' });
          return;
        }

        const docId = `${projectId}::doc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
        await d1Query(
          `INSERT INTO documents (
            id, user_id, project_id, slot_key, label, file_name, file_type,
            file_size, uploaded_at, storage_provider, r2_key, url
          ) VALUES (?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docId,
            user.id,
            projectId,
            label,
            file.fileName,
            file.fileType || 'application/octet-stream',
            Number(file.fileSize) || 0,
            file.uploadedAt || formatTodayISO(),
            file.storageProvider || 'r2',
            file.r2Key ?? null,
            file.url ?? null,
          ]
        );

        res.status(201).json({ id: docId });
      } catch (err) {
        handleApiError(res, err);
      }
    }
  );

  app.delete('/api/documents/:docId', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const docId = String(req.params.docId ?? '');

      const existingRows = await d1Query<{ r2_key: string | null }>(
        `SELECT r2_key FROM documents WHERE id = ? AND user_id = ? LIMIT 1`,
        [docId, user.id]
      );

      await d1Query(
        `DELETE FROM documents WHERE id = ? AND user_id = ?`,
        [docId, user.id]
      );

      await deleteR2KeysBestEffort([existingRows[0]?.r2_key]);
      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/tasks', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const projectId =
        typeof body.projectId === 'string' ? body.projectId : '';
      const status =
        body.status === 'in_progress' || body.status === 'done'
          ? body.status
          : 'todo';
      const priority =
        body.priority === 'priority' || body.priority === 'urgent'
          ? body.priority
          : 'routine';
      const dueDate = typeof body.dueDate === 'string' ? body.dueDate : '';
      const refNo = typeof body.refNo === 'string' ? body.refNo.trim() : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

      if (!title) {
        res.status(400).json({ error: 'Task title is required.' });
        return;
      }

      const taskId = `${user.id}::task-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
      const createdAt = formatTodayISO();
      const completedAt = status === 'done' ? createdAt : null;

      await d1Query(
        `INSERT INTO tasks (
          id, user_id, project_id, title, status, priority, due_date,
          ref_no, notes, created_at, completed_at, archived, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        [
          taskId,
          user.id,
          projectId,
          title,
          status,
          priority,
          dueDate,
          refNo,
          notes,
          createdAt,
          completedAt,
        ]
      );

      res.status(201).json({ id: taskId });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put('/api/tasks/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const taskId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;

      const existingRows = await d1Query<D1TaskRow>(
        `SELECT * FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`,
        [taskId, user.id]
      );
      const existing = existingRows[0];
      if (!existing) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const title =
        (typeof body.title === 'string' ? body.title.trim() : '') ||
        existing.title;
      const projectId =
        typeof body.projectId === 'string' ? body.projectId : existing.project_id;
      const status =
        body.status === 'todo' ||
        body.status === 'in_progress' ||
        body.status === 'done'
          ? body.status
          : existing.status;
      const priority =
        body.priority === 'routine' ||
        body.priority === 'priority' ||
        body.priority === 'urgent'
          ? body.priority
          : existing.priority;
      const dueDate =
        typeof body.dueDate === 'string' ? body.dueDate : existing.due_date;
      const refNo =
        typeof body.refNo === 'string' ? body.refNo.trim() : existing.ref_no;
      const notes =
        typeof body.notes === 'string' ? body.notes.trim() : existing.notes;
      const completedAt =
        status === 'done' ? existing.completed_at || formatTodayISO() : null;

      await d1Query(
        `UPDATE tasks
         SET title = ?, project_id = ?, status = ?, priority = ?, due_date = ?,
             ref_no = ?, notes = ?, completed_at = ?
         WHERE id = ? AND user_id = ?`,
        [
          title,
          projectId,
          status,
          priority,
          dueDate,
          refNo,
          notes,
          completedAt,
          taskId,
          user.id,
        ]
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.patch('/api/tasks/:id/status', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const taskId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const status =
        body.status === 'todo' ||
        body.status === 'in_progress' ||
        body.status === 'done'
          ? body.status
          : null;

      if (!status) {
        res.status(400).json({ error: 'Invalid task status.' });
        return;
      }

      const completedAt = status === 'done' ? formatTodayISO() : null;
      await d1Query(
        `UPDATE tasks SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
        [status, completedAt, taskId, user.id]
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.patch('/api/tasks/:id/due-date', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const taskId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const dueDate = typeof body.dueDate === 'string' ? body.dueDate : '';

      if (!dueDate) {
        res.status(400).json({ error: 'Due date is required.' });
        return;
      }

      await d1Query(
        `UPDATE tasks SET due_date = ? WHERE id = ? AND user_id = ?`,
        [dueDate, taskId, user.id]
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.patch('/api/tasks/:id/archive', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const taskId = String(req.params.id ?? '');

      const rows = await d1Query<{ archived: number }>(
        `SELECT archived FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`,
        [taskId, user.id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const nextArchived = rows[0].archived ? 0 : 1;
      const archivedAt = nextArchived ? formatTodayISO() : null;

      await d1Query(
        `UPDATE tasks SET archived = ?, archived_at = ? WHERE id = ? AND user_id = ?`,
        [nextArchived, archivedAt, taskId, user.id]
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const taskId = String(req.params.id ?? '');
      await d1Query(
        `DELETE FROM tasks WHERE id = ? AND user_id = ?`,
        [taskId, user.id]
      );
      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // =========================================================================
  // File Storage Endpoints (Cloudflare R2)
  // =========================================================================

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

        const proxyUrl = `/api/r2/file?key=${encodeURIComponent(
          r2Key
        )}&name=${encodeURIComponent(file.originalname)}`;

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
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
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
