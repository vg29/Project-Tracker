import {
  ExecutiveProfile,
  Project,
  ProjectFile,
  Task,
} from '../types';

const SESSION_TOKEN_KEY = 'aai_desk_session_token';

export type CoreDocSlotKey =
  | 'rfp'
  | 'eOfficeFile'
  | 'agreement'
  | 'purchaseOrder'
  | 'bg'
  | 'ip'
  | 'bills';

export interface D1UserRecord {
  id: string;
  email: string;
  name: string;
  designation: string;
  station: string;
  employeeId: string;
  createdAt: string;
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    if (response.status === 401) {
      setStoredToken(null);
    }
    throw new Error(
      payload?.error || `Request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

export async function getCurrentSessionUser(): Promise<D1UserRecord | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await apiRequest<{ user: D1UserRecord | null }>(
      '/api/auth/session'
    );
    if (!res.user) {
      setStoredToken(null);
    }
    return res.user;
  } catch (err) {
    setStoredToken(null);
    throw err;
  }
}

export async function loginD1User(
  identifier: string,
  password: string
): Promise<D1UserRecord> {
  const res = await apiRequest<{ token: string; user: D1UserRecord }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }
  );
  setStoredToken(res.token);
  return res.user;
}

export async function registerD1User(input: {
  name: string;
  designation: string;
  email: string;
  station: string;
  employeeId: string;
  password: string;
}): Promise<D1UserRecord> {
  const res = await apiRequest<{ token: string; user: D1UserRecord }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  setStoredToken(res.token);
  return res.user;
}

export async function logoutD1User(): Promise<void> {
  const token = getStoredToken();
  try {
    if (token) {
      await apiRequest<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      });
    }
  } finally {
    setStoredToken(null);
  }
}

export async function loadD1Workspace(): Promise<{
  profile: ExecutiveProfile;
  projects: Project[];
  tasks: Task[];
}> {
  return apiRequest<{
    profile: ExecutiveProfile;
    projects: Project[];
    tasks: Task[];
  }>('/api/workspace');
}

export async function saveD1UserProfile(
  profile: ExecutiveProfile
): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function createD1Project(data: {
  name: string;
  code: string;
  division: string;
  purchaseOrder?: ProjectFile;
}): Promise<void> {
  await apiRequest<{ id: string }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateD1Project(
  projectId: string,
  data: {
    name: string;
    code: string;
    division: string;
    purchaseOrder?: ProjectFile;
  }
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
}

export async function deleteD1Project(projectId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function upsertD1CoreDoc(
  projectId: string,
  slotKey: CoreDocSlotKey,
  label: string,
  file: ProjectFile
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/documents/core/${encodeURIComponent(slotKey)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ label, file }),
    }
  );
}

export async function removeD1CoreDoc(
  projectId: string,
  slotKey: CoreDocSlotKey
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/documents/core/${encodeURIComponent(slotKey)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function addD1CustomDoc(
  projectId: string,
  label: string,
  file: ProjectFile
): Promise<void> {
  await apiRequest<{ id: string }>(
    `/api/projects/${encodeURIComponent(projectId)}/documents/custom`,
    {
      method: 'POST',
      body: JSON.stringify({ label, file }),
    }
  );
}

export async function removeD1DocById(docId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/documents/${encodeURIComponent(docId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function createD1Task(
  data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>
): Promise<void> {
  await apiRequest<{ id: string }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateD1Task(
  taskId: string,
  data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
}

export async function updateD1TaskStatus(
  taskId: string,
  status: Task['status']
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
}

export async function updateD1TaskDueDate(
  taskId: string,
  dueDate: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}/due-date`,
    {
      method: 'PATCH',
      body: JSON.stringify({ dueDate }),
    }
  );
}

export async function toggleD1TaskArchive(taskId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}/archive`,
    {
      method: 'PATCH',
    }
  );
}

export async function deleteD1Task(taskId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function resetD1Workspace(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/workspace/reset', {
    method: 'POST',
  });
}
