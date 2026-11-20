export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'routine' | 'priority' | 'urgent';

export type WorkspaceView = 'tasks' | 'projects' | 'completed' | 'archived';

export type TaskDisplayMode = 'list' | 'board';

export interface ProjectFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  storageProvider?: 'r2' | 'local';
  r2Key?: string;
  url?: string;
  dataUrl?: string;
}

export type PurchaseOrderDoc = ProjectFile;

export interface CustomProjectDocument {
  id: string;
  label: string;
  file: ProjectFile;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  division: string;
  createdAt: string;
  rfp?: ProjectFile;
  eOfficeFile?: ProjectFile;
  agreement?: ProjectFile;
  purchaseOrder?: ProjectFile;
  bg?: ProjectFile;
  ip?: ProjectFile;
  bills?: ProjectFile;
  otherDocuments?: CustomProjectDocument[];
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  refNo: string;
  notes: string;
  createdAt: string;
  completedAt?: string;
  archived?: boolean;
  archivedAt?: string;
}

export interface ExecutiveProfile {
  name: string;
  designation: string;
  station: string;
  employeeId: string;
}
