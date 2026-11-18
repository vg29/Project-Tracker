import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
} from 'lucide-react';
import { Project, Task, TaskPriority, TaskStatus } from '../types';
import { formatShortDate, getDueState } from '../utils/date';

interface TaskListProps {
  tasks: Task[];
  projectsById: Record<string, Project>;
  emptyTitle: string;
  emptyDescription: string;
  onToggleDone: (taskId: string) => void;
  onChangeStatus: (taskId: string, status: TaskStatus) => void;
  onExtendDueDate: (task: Task) => void;
  onToggleArchive: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onNewTask?: () => void;
}

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; textClass: string }
> = {
  urgent: { label: 'Urgent', textClass: 'text-red-700 font-medium' },
  priority: { label: 'Priority', textClass: 'text-amber-700 font-medium' },
  routine: { label: 'Routine', textClass: 'text-slate-600' },
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export function TaskList({
  tasks,
  projectsById,
  emptyTitle,
  emptyDescription,
  onToggleDone,
  onChangeStatus,
  onExtendDueDate,
  onToggleArchive,
  onDeleteTask,
  onEditTask,
  onNewTask,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
        <p className="font-display text-base font-semibold text-slate-900">
          {emptyTitle}
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          {emptyDescription}
        </p>
        {onNewTask && (
          <button
            type="button"
            onClick={onNewTask}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
          >
            Add First Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_8.5rem_6rem_9.5rem_4.5rem] items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-slate-600 md:grid">
        <span className="sr-only">Complete</span>
        <span>Task &amp; Reference</span>
        <span>Status</span>
        <span>Priority</span>
        <span className="text-right">Due Date</span>
        <span className="text-right">Actions</span>
      </div>

      <ul className="divide-y divide-slate-200">
        {tasks.map((task) => {
          const project = projectsById[task.projectId];
          const isDone = task.status === 'done';
          const isArchived = Boolean(task.archived);
          const dueState = getDueState(task.dueDate, isDone || isArchived);
          const priorityInfo = PRIORITY_META[task.priority];

          return (
            <li
              key={task.id}
              className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 md:grid md:grid-cols-[2.25rem_minmax(0,1fr)_8.5rem_6rem_9.5rem_4.5rem] md:items-center md:gap-4"
            >
              <div className="flex items-start gap-3 md:contents">
                <button
                  type="button"
                  onClick={() => onToggleDone(task.id)}
                  aria-label={
                    isDone ? `Mark "${task.title}" as To Do` : `Mark "${task.title}" as Done`
                  }
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:text-blue-900 md:mt-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : task.status === 'in_progress' ? (
                    <Clock className="h-5 w-5 text-amber-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 group-hover:text-slate-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
                >
                  <p
                    className={`truncate text-sm font-medium ${
                      isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span>{project ? project.name : 'General Station Work'}</span>
                    {task.refNo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {task.refNo}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pl-9 md:contents md:pl-0">
                <div>
                  <label htmlFor={`status-${task.id}`} className="sr-only">
                    Status for {task.title}
                  </label>
                  <select
                    id={`status-${task.id}`}
                    value={task.status}
                    onChange={(e) =>
                      onChangeStatus(task.id, e.target.value as TaskStatus)
                    }
                    className={`w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium transition-colors hover:border-slate-300 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20 ${
                      task.status === 'done'
                        ? 'text-emerald-700'
                        : task.status === 'in_progress'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    <option value="todo">{STATUS_LABELS.todo}</option>
                    <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                    <option value="done">{STATUS_LABELS.done}</option>
                  </select>
                </div>

                <div className={`text-xs whitespace-nowrap ${priorityInfo.textClass}`}>
                  {task.priority === 'urgent' && (
                    <AlertTriangle
                      className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom text-red-600"
                      aria-hidden="true"
                    />
                  )}
                  {priorityInfo.label}
                </div>

                <div className="text-right font-mono text-xs tabular-nums whitespace-nowrap">
                  <div
                    className={
                      dueState === 'overdue'
                        ? 'font-semibold text-red-600'
                        : dueState === 'due_soon'
                        ? 'font-medium text-amber-700'
                        : 'text-slate-600'
                    }
                  >
                    {formatShortDate(task.dueDate)}
                  </div>
                  {dueState === 'overdue' && (
                    <div className="mt-0.5 flex items-center justify-end gap-1.5 font-sans text-[11px]">
                      <span className="font-medium text-red-600">Overdue</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => onExtendDueDate(task)}
                        className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
                      >
                        <CalendarPlus className="h-3 w-3" aria-hidden="true" />
                        Extend
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleArchive(task.id)}
                    aria-label={
                      isArchived
                        ? `Restore "${task.title}"`
                        : `Archive "${task.title}"`
                    }
                    title={isArchived ? 'Restore task' : 'Archive task'}
                    className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    {isArchived ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    aria-label={`Delete "${task.title}"`}
                    title="Delete task"
                    className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
