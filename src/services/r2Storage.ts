import { ProjectFile } from '../types';

export const MAX_R2_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export function getProjectFileHref(file: ProjectFile): string {
  if (file.url) return file.url;
  if (file.r2Key) {
    return `/api/r2/file?key=${encodeURIComponent(file.r2Key)}&name=${encodeURIComponent(file.fileName)}`;
  }
  return file.dataUrl || '#';
}

export async function uploadFileToR2(
  file: File,
  meta: { userId: string; projectId: string; slotKey: string }
): Promise<ProjectFile> {
  if (file.size > MAX_R2_FILE_BYTES) {
    throw new Error('File exceeds 25 MB limit. Please upload a smaller document.');
  }

  const formData = new FormData();
  formData.append('userId', meta.userId);
  formData.append('projectId', meta.projectId);
  formData.append('slotKey', meta.slotKey);
  formData.append('file', file);

  const response = await fetch('/api/r2/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | (ProjectFile & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error || 'Failed to upload file to Cloudflare R2.'
    );
  }

  return {
    fileName: payload.fileName,
    fileType: payload.fileType,
    fileSize: payload.fileSize,
    uploadedAt: payload.uploadedAt,
    storageProvider: 'r2',
    r2Key: payload.r2Key,
    url: payload.url,
  };
}

export async function deleteFileFromR2(r2Key?: string): Promise<void> {
  if (!r2Key) return;
  try {
    await fetch('/api/r2/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: r2Key }),
    });
  } catch (err) {
    console.warn('Cloudflare R2 cleanup failed:', err);
  }
}

export async function deleteFilesFromR2(r2Keys: string[]): Promise<void> {
  const validKeys = r2Keys.filter(Boolean);
  if (validKeys.length === 0) return;
  try {
    await fetch('/api/r2/delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: validKeys }),
    });
  } catch (err) {
    console.warn('Cloudflare R2 batch cleanup failed:', err);
  }
}
