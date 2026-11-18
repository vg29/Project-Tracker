import { FormEvent, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, CalendarPlus, Trash2, X } from 'lucide-react';
import { Project, Task, TaskPriority, TaskStatus } from '../types';
import { addDaysISO, getDueState, getTodayISO } from '../utils/date';

interface TaskModalProps {
  open: boolean;
  task: Task | null;
  projects: Project[];
  defaultProjectId: string | null;
  onClose: () => void;
  onSave: (data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>, existingId?: string) => void;
  onToggleArchive: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function TaskModal({
  open,
  task,
  projects,
  defaultProjectId,
  onClose,
  onSave,
  onToggleArchive,
  onDelete,
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('routine');
  const [dueDate, setDueDate] = useState(getTodayISO());
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setProjectId(task.projectId);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate || getTodayISO());
      setRefNo(task.refNo || '');
      setNotes(task.notes || '');
    } else {
      setTitle('');
      setProjectId(defaultProjectId || projects[0]?.id || '');
      setStatus('todo');
      setPriority('routine');
      setDueDate(getTodayISO());
      setRefNo('');
      setNotes('');
    }
  }, [open, task, projects, defaultProjectId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const isOverdue =
    Boolean(task) &&
    getDueState(dueDate, status === 'done' || Boolean(task?.archived)) === 'overdue';
  const today = getTodayISO();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(
      {
        title: title.trim(),
        projectId,
        status,
        priority,
        dueDate,
        refNo: refNo.trim(),
        notes: notes.trim(),
      },
      task?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2
            id="task-modal-title"
            className="font-display text-base font-semibold text-slate-900"
          >
            {task ? 'Edit Task' : 'New Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label
              htmlFor="task-title"
              className="block text-xs font-medium text-slate-700"
            >
              Task Title
            </label>
            <input
              id="task-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Submit weekly runway friction test log"
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="task-project"
                className="block text-xs font-medium text-slate-700"
              >
                Station Project
              </label>
              <select
                id="task-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              >
                {projects.length === 0 && <option value="">General Station Work</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="task-ref"
                className="block text-xs font-medium text-slate-700"
              >
                File / Ref No. (Optional)
              </label>
              <input
                id="task-ref"
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g., AAI/OPS/26/120"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="task-status"
                className="block text-xs font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-priority"
                className="block text-xs font-medium text-slate-700"
              >
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              >
                <option value="routine">Routine</option>
                <option value="priority">Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-due"
                className="flex items-center justify-between text-xs font-medium text-slate-700"
              >
                <span>Due Date</span>
                {isOverdue && (
                  <span className="font-semibold text-red-600">Overdue</span>
                )}
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              />
            </div>
          </div>

          {isOverdue && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <CalendarPlus className="h-3.5 w-3.5 text-blue-900" aria-hidden="true" />
                Extend due date from today:
              </span>
              <div className="flex items-center gap-1.5">
                {[3, 7, 14].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDueDate(addDaysISO(today, days))}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-blue-900 transition-colors hover:border-blue-800 hover:bg-blue-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    +{days}d
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="task-notes"
              className="block text-xs font-medium text-slate-700"
            >
              Notes
            </label>
            <textarea
              id="task-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Coordination details, shift handoff remarks, or enclosure notes..."
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
            {task ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onToggleArchive(task.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                >
                  {task.archived ? (
                    <>
                      <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                      Restore
                    </>
                  ) : (
                    <>
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      Archive
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(task.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
              >
                {task ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
