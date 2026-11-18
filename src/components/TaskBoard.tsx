import { AlertTriangle, Archive, ArrowLeft, ArrowRight, CalendarPlus, Trash2 } from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';
import { formatShortDate, getDueState } from '../utils/date';

interface TaskBoardProps {
  tasks: Task[];
  projectsById: Record<string, Project>;
  onChangeStatus: (taskId: string, status: TaskStatus) => void;
  onExtendDueDate: (task: Task) => void;
  onToggleArchive: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
];

export function TaskBoard({
  tasks,
  projectsById,
  onChangeStatus,
  onExtendDueDate,
  onToggleArchive,
  onDeleteTask,
  onEditTask,
}: TaskBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);

        return (
          <section
            key={col.status}
            aria-label={col.title}
            className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/70"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {col.title}
              </h3>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 p-3">
              {columnTasks.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  No tasks in {col.title.toLowerCase()}
                </p>
              ) : (
                columnTasks.map((task) => {
                  const project = projectsById[task.projectId];
                  const isDone = task.status === 'done';
                  const dueState = getDueState(task.dueDate, isDone);

                  return (
                    <article
                      key={task.id}
                      className="rounded-md border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300"
                    >
                      <button
                        type="button"
                        onClick={() => onEditTask(task)}
                        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
                      >
                        <p
                          className={`text-sm font-medium leading-snug ${
                            isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="mt-1.5 truncate text-xs text-slate-500">
                          {project ? project.name : 'General'}
                          {task.refNo ? ` · ${task.refNo}` : ''}
                        </p>
                      </button>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-mono tabular-nums ${
                              dueState === 'overdue'
                                ? 'font-semibold text-red-600'
                                : dueState === 'due_soon'
                                ? 'font-medium text-amber-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {formatShortDate(task.dueDate)}
                          </span>
                          {dueState === 'overdue' && (
                            <button
                              type="button"
                              onClick={() => onExtendDueDate(task)}
                              title="Extend due date"
                              className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-blue-900 hover:underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
                            >
                              <CalendarPlus className="h-3 w-3" aria-hidden="true" />
                              Extend
                            </button>
                          )}
                          {task.priority === 'urgent' && !isDone && (
                            <span className="inline-flex items-center gap-1 font-medium text-red-700">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              Urgent
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5">
                          {col.status !== 'todo' && (
                            <button
                              type="button"
                              onClick={() =>
                                onChangeStatus(
                                  task.id,
                                  col.status === 'done' ? 'in_progress' : 'todo'
                                )
                              }
                              aria-label={`Move "${task.title}" left`}
                              title={
                                col.status === 'done'
                                  ? 'Move to In Progress'
                                  : 'Move to To Do'
                              }
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {col.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() =>
                                onChangeStatus(
                                  task.id,
                                  col.status === 'todo' ? 'in_progress' : 'done'
                                )
                              }
                              aria-label={`Move "${task.title}" right`}
                              title={
                                col.status === 'todo'
                                  ? 'Move to In Progress'
                                  : 'Mark Done'
                              }
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onToggleArchive(task.id)}
                            aria-label={`Archive "${task.title}"`}
                            title="Archive task"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label={`Delete "${task.title}"`}
                            title="Delete task"
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
