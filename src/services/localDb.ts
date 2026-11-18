import {
  DEFAULT_DESIGNATION,
  DEFAULT_PROFILE,
  DEFAULT_PROJECTS,
  DEFAULT_TASKS,
  DESIGNATION_OPTIONS,
} from '../data/seed';
import {
  CustomProjectDocument,
  ExecutiveProfile,
  Project,
  ProjectFile,
  Task,
} from '../types';
import { getTodayISO } from '../utils/date';

const DB_NAME = 'aai_desk_local_db';
const DB_VERSION = 1;

export type CoreDocSlotKey =
  | 'rfp'
  | 'eOfficeFile'
  | 'agreement'
  | 'purchaseOrder'
  | 'bg'
  | 'ip'
  | 'bills';

export interface LocalUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  designation: string;
  station: string;
  employeeId: string;
  createdAt: string;
}

interface StoredProjectRecord {
  id: string;
  userId: string;
  name: string;
  code: string;
  division: string;
  createdAt: string;
}

interface StoredDocumentRecord {
  id: string; // `${projectId}::${slotKey}` or `${projectId}::doc-${ts}`
  userId: string;
  projectId: string;
  slotKey: CoreDocSlotKey | 'custom';
  label: string;
  file: ProjectFile;
}

interface StoredTaskRecord extends Task {
  userId: string;
}

function normalizeDesignation(value?: string): string {
  if (!value) return DEFAULT_DESIGNATION;
  if (value === 'Assistant Manager (IT)') return 'Assistant Manager(IT)';
  if ((DESIGNATION_OPTIONS as readonly string[]).includes(value)) {
    return value;
  }
  return DEFAULT_DESIGNATION;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('email', 'email', { unique: true });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('projects')) {
        const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectsStore.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('documents')) {
        const docsStore = db.createObjectStore('documents', { keyPath: 'id' });
        docsStore.createIndex('userId', 'userId', { unique: false });
        docsStore.createIndex('projectId', 'projectId', { unique: false });
      }

      if (!db.objectStoreNames.contains('tasks')) {
        const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
        tasksStore.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open local database.'));
  });
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
  }
  // Fallback deterministic hash if SubtleCrypto is unavailable
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'));
  });
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Database request failed.'));
  });
}

let seedPromise: Promise<void> | null = null;

async function ensureDefaultAccountSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const db = await openDatabase();
    const readTx = db.transaction('users', 'readonly');
    const existingUsers = await reqPromise(readTx.objectStore('users').getAll());
    if (existingUsers.length > 0) {
      db.close();
      return;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword('AAI@2026', salt);
    const defaultUserId = 'user-raghav-it';

    const tx = db.transaction(['users', 'projects', 'tasks'], 'readwrite');
    tx.objectStore('users').put({
      id: defaultUserId,
      email: 'raghav.it@aai.aero',
      passwordHash,
      salt,
      name: DEFAULT_PROFILE.name,
      designation: DEFAULT_DESIGNATION,
      station: DEFAULT_PROFILE.station,
      employeeId: DEFAULT_PROFILE.employeeId,
      createdAt: getTodayISO(),
    } satisfies LocalUserRecord);

    const projectStore = tx.objectStore('projects');
    for (const project of DEFAULT_PROJECTS) {
      projectStore.put({
        id: `${defaultUserId}::${project.id}`,
        userId: defaultUserId,
        name: project.name,
        code: project.code,
        division: project.division,
        createdAt: project.createdAt,
      } satisfies StoredProjectRecord);
    }

    const taskStore = tx.objectStore('tasks');
    for (const task of DEFAULT_TASKS) {
      taskStore.put({
        ...task,
        id: `${defaultUserId}::${task.id}`,
        projectId: task.projectId ? `${defaultUserId}::${task.projectId}` : '',
        userId: defaultUserId,
        archived: false,
      } satisfies StoredTaskRecord);
    }

    await txDone(tx);
    db.close();
  })();

  try {
    await seedPromise;
  } finally {
    seedPromise = null;
  }
}

export async function getCurrentSessionUser(): Promise<LocalUserRecord | null> {
  await ensureDefaultAccountSeeded();
  const db = await openDatabase();
  try {
    const tx = db.transaction(['sessions', 'users'], 'readonly');
    const session = (await reqPromise(
      tx.objectStore('sessions').get('current')
    )) as { id: string; userId: string } | undefined;

    if (!session?.userId) return null;
    const user = (await reqPromise(
      tx.objectStore('users').get(session.userId)
    )) as LocalUserRecord | undefined;

    if (!user) return null;
    return { ...user, designation: normalizeDesignation(user.designation) };
  } finally {
    db.close();
  }
}

export async function loginLocalUser(
  identifier: string,
  password: string
): Promise<LocalUserRecord> {
  await ensureDefaultAccountSeeded();
  const normalized = identifier.trim().toLowerCase();
  if (!normalized || !password) {
    throw new Error('Please enter both your email / employee ID and password.');
  }

  const db = await openDatabase();
  try {
    const readTx = db.transaction('users', 'readonly');
    const allUsers = (await reqPromise(
      readTx.objectStore('users').getAll()
    )) as LocalUserRecord[];

    const matched = allUsers.find(
      (u) =>
        u.email.toLowerCase() === normalized ||
        u.employeeId.toLowerCase() === normalized
    );

    if (!matched) {
      throw new Error('No account found with that email or employee ID.');
    }

    const candidateHash = await hashPassword(password, matched.salt);
    if (candidateHash !== matched.passwordHash) {
      throw new Error('Incorrect password. Please try again.');
    }

    const writeTx = db.transaction('sessions', 'readwrite');
    writeTx.objectStore('sessions').put({ id: 'current', userId: matched.id });
    await txDone(writeTx);

    return { ...matched, designation: normalizeDesignation(matched.designation) };
  } finally {
    db.close();
  }
}

export async function registerLocalUser(input: {
  name: string;
  designation: string;
  email: string;
  station: string;
  employeeId: string;
  password: string;
}): Promise<LocalUserRecord> {
  await ensureDefaultAccountSeeded();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const designation = normalizeDesignation(input.designation);
  const station = input.station.trim() || 'AAI Station';
  const employeeId = input.employeeId.trim().toUpperCase();

  if (!name || !email || !input.password) {
    throw new Error('Full name, email, and password are required.');
  }
  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const db = await openDatabase();
  try {
    const readTx = db.transaction('users', 'readonly');
    const existing = (await reqPromise(
      readTx.objectStore('users').index('email').get(email)
    )) as LocalUserRecord | undefined;

    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const userId = `user-${Date.now()}`;
    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);

    const newUser: LocalUserRecord = {
      id: userId,
      email,
      passwordHash,
      salt,
      name,
      designation,
      station,
      employeeId,
      createdAt: getTodayISO(),
    };

    const tx = db.transaction(['users', 'sessions', 'projects', 'tasks'], 'readwrite');
    tx.objectStore('users').put(newUser);
    tx.objectStore('sessions').put({ id: 'current', userId });

    const projectStore = tx.objectStore('projects');
    for (const project of DEFAULT_PROJECTS) {
      projectStore.put({
        id: `${userId}::${project.id}`,
        userId,
        name: project.name,
        code: project.code,
        division: project.division,
        createdAt: project.createdAt,
      } satisfies StoredProjectRecord);
    }

    const taskStore = tx.objectStore('tasks');
    for (const task of DEFAULT_TASKS) {
      taskStore.put({
        ...task,
        id: `${userId}::${task.id}`,
        projectId: task.projectId ? `${userId}::${task.projectId}` : '',
        userId,
        archived: false,
      } satisfies StoredTaskRecord);
    }

    await txDone(tx);
    return newUser;
  } finally {
    db.close();
  }
}

export async function logoutLocalUser(): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').delete('current');
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function loadUserWorkspace(userId: string): Promise<{
  profile: ExecutiveProfile;
  projects: Project[];
  tasks: Task[];
}> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['users', 'projects', 'documents', 'tasks'], 'readonly');

    const user = (await reqPromise(
      tx.objectStore('users').get(userId)
    )) as LocalUserRecord | undefined;

    const projectRows = (await reqPromise(
      tx.objectStore('projects').index('userId').getAll(userId)
    )) as StoredProjectRecord[];

    const docRows = (await reqPromise(
      tx.objectStore('documents').index('userId').getAll(userId)
    )) as StoredDocumentRecord[];

    const taskRows = (await reqPromise(
      tx.objectStore('tasks').index('userId').getAll(userId)
    )) as StoredTaskRecord[];

    const docsByProject: Record<
      string,
      Partial<Record<CoreDocSlotKey, ProjectFile>> & {
        otherDocuments: CustomProjectDocument[];
      }
    > = {};

    for (const docRow of docRows) {
      if (!docsByProject[docRow.projectId]) {
        docsByProject[docRow.projectId] = { otherDocuments: [] };
      }
      const bucket = docsByProject[docRow.projectId];
      if (docRow.slotKey === 'custom') {
        bucket.otherDocuments.push({
          id: docRow.id,
          label: docRow.label,
          file: docRow.file,
        });
      } else {
        bucket[docRow.slotKey] = docRow.file;
      }
    }

    const projects: Project[] = projectRows
      .map((p) => {
        const docs = docsByProject[p.id];
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          division: p.division,
          createdAt: p.createdAt,
          rfp: docs?.rfp,
          eOfficeFile: docs?.eOfficeFile,
          agreement: docs?.agreement,
          purchaseOrder: docs?.purchaseOrder,
          bg: docs?.bg,
          ip: docs?.ip,
          bills: docs?.bills,
          otherDocuments: docs?.otherDocuments ?? [],
        };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const tasks: Task[] = taskRows.map(({ userId: _u, ...rest }) => rest);

    return {
      profile: {
        name: user?.name ?? DEFAULT_PROFILE.name,
        designation: normalizeDesignation(user?.designation),
        station: user?.station ?? DEFAULT_PROFILE.station,
        employeeId: user?.employeeId ?? DEFAULT_PROFILE.employeeId,
      },
      projects,
      tasks,
    };
  } finally {
    db.close();
  }
}

export async function saveLocalUserProfile(
  userId: string,
  profile: ExecutiveProfile
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const user = (await reqPromise(store.get(userId))) as LocalUserRecord | undefined;
    if (!user) return;
    store.put({
      ...user,
      name: profile.name,
      designation: normalizeDesignation(profile.designation),
      station: profile.station,
      employeeId: profile.employeeId,
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function createLocalProject(
  userId: string,
  data: { name: string; code: string; division: string; purchaseOrder?: ProjectFile }
): Promise<void> {
  const db = await openDatabase();
  try {
    const projectId = `${userId}::proj-${Date.now()}`;
    const tx = db.transaction(['projects', 'documents'], 'readwrite');

    tx.objectStore('projects').put({
      id: projectId,
      userId,
      name: data.name,
      code: data.code,
      division: data.division,
      createdAt: getTodayISO(),
    } satisfies StoredProjectRecord);

    if (data.purchaseOrder) {
      tx.objectStore('documents').put({
        id: `${projectId}::purchaseOrder`,
        userId,
        projectId,
        slotKey: 'purchaseOrder',
        label: 'PO',
        file: data.purchaseOrder,
      } satisfies StoredDocumentRecord);
    }

    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function updateLocalProject(
  userId: string,
  projectId: string,
  data: { name: string; code: string; division: string; purchaseOrder?: ProjectFile }
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['projects', 'documents'], 'readwrite');
    const projectStore = tx.objectStore('projects');
    const existing = (await reqPromise(
      projectStore.get(projectId)
    )) as StoredProjectRecord | undefined;

    if (!existing || existing.userId !== userId) return;

    projectStore.put({
      ...existing,
      name: data.name,
      code: data.code,
      division: data.division,
    });

    const docsStore = tx.objectStore('documents');
    const poDocId = `${projectId}::purchaseOrder`;
    if (data.purchaseOrder) {
      docsStore.put({
        id: poDocId,
        userId,
        projectId,
        slotKey: 'purchaseOrder',
        label: 'PO',
        file: data.purchaseOrder,
      } satisfies StoredDocumentRecord);
    } else {
      docsStore.delete(poDocId);
    }

    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteLocalProject(
  userId: string,
  projectId: string
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['projects', 'documents', 'tasks'], 'readwrite');
    const docRows = (await reqPromise(
      tx.objectStore('documents').index('projectId').getAll(projectId)
    )) as StoredDocumentRecord[];

    const docsStore = tx.objectStore('documents');
    for (const d of docRows) {
      if (d.userId === userId) {
        docsStore.delete(d.id);
      }
    }

    const taskRows = (await reqPromise(
      tx.objectStore('tasks').index('userId').getAll(userId)
    )) as StoredTaskRecord[];

    const tasksStore = tx.objectStore('tasks');
    for (const t of taskRows) {
      if (t.projectId === projectId) {
        tasksStore.put({ ...t, projectId: '' });
      }
    }

    tx.objectStore('projects').delete(projectId);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function upsertLocalCoreDoc(
  userId: string,
  projectId: string,
  slotKey: CoreDocSlotKey,
  label: string,
  file: ProjectFile
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').put({
      id: `${projectId}::${slotKey}`,
      userId,
      projectId,
      slotKey,
      label,
      file,
    } satisfies StoredDocumentRecord);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function removeLocalCoreDoc(
  projectId: string,
  slotKey: CoreDocSlotKey
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').delete(`${projectId}::${slotKey}`);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function addLocalCustomDoc(
  userId: string,
  projectId: string,
  label: string,
  file: ProjectFile
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').put({
      id: `${projectId}::doc-${Date.now()}`,
      userId,
      projectId,
      slotKey: 'custom',
      label,
      file,
    } satisfies StoredDocumentRecord);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function removeLocalDocById(docId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').delete(docId);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function createLocalTask(
  userId: string,
  data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('tasks', 'readwrite');
    tx.objectStore('tasks').put({
      ...data,
      id: `${userId}::task-${Date.now()}`,
      userId,
      createdAt: getTodayISO(),
      completedAt: data.status === 'done' ? getTodayISO() : undefined,
      archived: false,
    } satisfies StoredTaskRecord);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function updateLocalTask(
  userId: string,
  taskId: string,
  data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const existing = (await reqPromise(store.get(taskId))) as
      | StoredTaskRecord
      | undefined;
    if (!existing || existing.userId !== userId) return;

    store.put({
      ...existing,
      ...data,
      completedAt:
        data.status === 'done'
          ? existing.completedAt || getTodayISO()
          : undefined,
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function updateLocalTaskStatus(
  userId: string,
  taskId: string,
  status: Task['status']
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const existing = (await reqPromise(store.get(taskId))) as
      | StoredTaskRecord
      | undefined;
    if (!existing || existing.userId !== userId) return;

    store.put({
      ...existing,
      status,
      completedAt: status === 'done' ? getTodayISO() : undefined,
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function updateLocalTaskDueDate(
  userId: string,
  taskId: string,
  dueDate: string
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const existing = (await reqPromise(store.get(taskId))) as
      | StoredTaskRecord
      | undefined;
    if (!existing || existing.userId !== userId) return;

    store.put({
      ...existing,
      dueDate,
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function toggleLocalTaskArchive(
  userId: string,
  taskId: string
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const existing = (await reqPromise(store.get(taskId))) as
      | StoredTaskRecord
      | undefined;
    if (!existing || existing.userId !== userId) return;

    const nextArchived = !existing.archived;
    store.put({
      ...existing,
      archived: nextArchived,
      archivedAt: nextArchived ? getTodayISO() : undefined,
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteLocalTask(
  userId: string,
  taskId: string
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const existing = (await reqPromise(store.get(taskId))) as
      | StoredTaskRecord
      | undefined;
    if (existing && existing.userId === userId) {
      store.delete(taskId);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function resetLocalWorkspace(userId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      ['users', 'projects', 'documents', 'tasks'],
      'readwrite'
    );

    const projectRows = (await reqPromise(
      tx.objectStore('projects').index('userId').getAll(userId)
    )) as StoredProjectRecord[];
    for (const p of projectRows) {
      tx.objectStore('projects').delete(p.id);
    }

    const docRows = (await reqPromise(
      tx.objectStore('documents').index('userId').getAll(userId)
    )) as StoredDocumentRecord[];
    for (const d of docRows) {
      tx.objectStore('documents').delete(d.id);
    }

    const taskRows = (await reqPromise(
      tx.objectStore('tasks').index('userId').getAll(userId)
    )) as StoredTaskRecord[];
    for (const t of taskRows) {
      tx.objectStore('tasks').delete(t.id);
    }

    const projectStore = tx.objectStore('projects');
    for (const project of DEFAULT_PROJECTS) {
      projectStore.put({
        id: `${userId}::${project.id}`,
        userId,
        name: project.name,
        code: project.code,
        division: project.division,
        createdAt: project.createdAt,
      } satisfies StoredProjectRecord);
    }

    const taskStore = tx.objectStore('tasks');
    for (const task of DEFAULT_TASKS) {
      taskStore.put({
        ...task,
        id: `${userId}::${task.id}`,
        projectId: task.projectId ? `${userId}::${task.projectId}` : '',
        userId,
        archived: false,
      } satisfies StoredTaskRecord);
    }

    await txDone(tx);
  } finally {
    db.close();
  }
}
