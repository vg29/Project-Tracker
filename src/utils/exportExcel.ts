import * as XLSX from 'xlsx';
import { Project, Task, TaskPriority, TaskStatus } from '../types';
import { getTodayISO } from './date';

function formatStatus(status: TaskStatus): string {
  switch (status) {
    case 'todo':
      return 'To Do';
    case 'in_progress':
      return 'In Progress';
    case 'done':
      return 'Done';
  }
}

function formatPriority(priority: TaskPriority): string {
  switch (priority) {
    case 'routine':
      return 'Routine';
    case 'priority':
      return 'Priority';
    case 'urgent':
      return 'Urgent';
  }
}

function sanitizeFileSlug(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'project';
}

const ONGOING_HEADERS = [
  'S. No.',
  'Project',
  'Project Code',
  'Task Title',
  'Status',
  'Priority',
  'Due Date',
  'File Ref No.',
  'Notes',
  'Created Date',
];

const COMPLETED_HEADERS = [
  'S. No.',
  'Project',
  'Project Code',
  'Task Title',
  'Status',
  'Priority',
  'Due Date',
  'Completed Date',
  'File Ref No.',
  'Notes',
  'Created Date',
];

const ARCHIVED_HEADERS = [
  'S. No.',
  'Project',
  'Project Code',
  'Task Title',
  'Status',
  'Priority',
  'Due Date',
  'Archived Date',
  'File Ref No.',
  'Notes',
  'Created Date',
];

function applyColumnWidths(
  worksheet: XLSX.WorkSheet,
  widths: number[]
): void {
  worksheet['!cols'] = widths.map((wch) => ({ wch }));
}

export function downloadProjectTasksExcel(
  project: Project,
  allTasks: Task[]
): void {
  const projectTasks = allTasks.filter((t) => t.projectId === project.id);

  const ongoingTasks = projectTasks
    .filter((t) => !t.archived && t.status !== 'done')
    .sort((a, b) =>
      (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')
    );

  const completedTasks = projectTasks
    .filter((t) => !t.archived && t.status === 'done')
    .sort((a, b) =>
      (b.completedAt || b.dueDate || '').localeCompare(
        a.completedAt || a.dueDate || ''
      )
    );

  const archivedTasks = projectTasks
    .filter((t) => Boolean(t.archived))
    .sort((a, b) =>
      (b.archivedAt || b.createdAt || '').localeCompare(
        a.archivedAt || a.createdAt || ''
      )
    );

  const ongoingRows = ongoingTasks.map((task, idx) => ({
    'S. No.': idx + 1,
    Project: project.name,
    'Project Code': project.code || '',
    'Task Title': task.title,
    Status: formatStatus(task.status),
    Priority: formatPriority(task.priority),
    'Due Date': task.dueDate || '',
    'File Ref No.': task.refNo || '',
    Notes: task.notes || '',
    'Created Date': task.createdAt || '',
  }));

  const completedRows = completedTasks.map((task, idx) => ({
    'S. No.': idx + 1,
    Project: project.name,
    'Project Code': project.code || '',
    'Task Title': task.title,
    Status: formatStatus(task.status),
    Priority: formatPriority(task.priority),
    'Due Date': task.dueDate || '',
    'Completed Date': task.completedAt || '',
    'File Ref No.': task.refNo || '',
    Notes: task.notes || '',
    'Created Date': task.createdAt || '',
  }));

  const archivedRows = archivedTasks.map((task, idx) => ({
    'S. No.': idx + 1,
    Project: project.name,
    'Project Code': project.code || '',
    'Task Title': task.title,
    Status: formatStatus(task.status),
    Priority: formatPriority(task.priority),
    'Due Date': task.dueDate || '',
    'Archived Date': task.archivedAt || '',
    'File Ref No.': task.refNo || '',
    Notes: task.notes || '',
    'Created Date': task.createdAt || '',
  }));

  const ongoingSheet = XLSX.utils.json_to_sheet(ongoingRows, {
    header: ONGOING_HEADERS,
  });
  applyColumnWidths(ongoingSheet, [8, 28, 16, 42, 14, 12, 14, 18, 44, 14]);

  const completedSheet = XLSX.utils.json_to_sheet(completedRows, {
    header: COMPLETED_HEADERS,
  });
  applyColumnWidths(completedSheet, [8, 28, 16, 42, 14, 12, 14, 16, 18, 44, 14]);

  const archivedSheet = XLSX.utils.json_to_sheet(archivedRows, {
    header: ARCHIVED_HEADERS,
  });
  applyColumnWidths(archivedSheet, [8, 28, 16, 42, 14, 12, 14, 16, 18, 44, 14]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ongoingSheet, 'Ongoing');
  XLSX.utils.book_append_sheet(workbook, completedSheet, 'Completed');
  XLSX.utils.book_append_sheet(workbook, archivedSheet, 'Archived');

  const slug = sanitizeFileSlug(project.code || project.name);
  const fileName = `${slug}_tasks_${getTodayISO()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
