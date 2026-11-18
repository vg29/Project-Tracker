import { FormEvent, useEffect, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { Task } from '../types';
import { addDaysISO, formatShortDate, getTodayISO } from '../utils/date';

interface ExtendDueDateModalProps {
  task: Task | null;
  onClose: () => void;
  onExtend: (taskId: string, newDueDate: string) => void;
}

const PRESET_DAYS = [
  { label: '+3 Days', days: 3 },
  { label: '+7 Days', days: 7 },
  { label: '+14 Days', days: 14 },
];

export function ExtendDueDateModal({
  task,
  onClose,
  onExtend,
}: ExtendDueDateModalProps) {
  const today = getTodayISO();
  const [newDueDate, setNewDueDate] = useState(addDaysISO(today, 7));

  useEffect(() => {
    if (!task) return;
    setNewDueDate(addDaysISO(getTodayISO(), 7));
  }, [task]);

  useEffect(() => {
    if (!task) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [task, onClose]);

  if (!task) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newDueDate) return;
    onExtend(task.id, newDueDate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extend-due-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-blue-900" aria-hidden="true" />
            <h2
              id="extend-due-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              Extend Due Date
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <p className="truncate text-sm font-medium text-slate-900">
              {task.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Current due date:{' '}
              <span className="font-mono font-semibold tabular-nums text-red-600">
                {formatShortDate(task.dueDate)}
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700">Quick extend from today</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRESET_DAYS.map((preset) => {
                const targetDate = addDaysISO(today, preset.days);
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => {
                      onExtend(task.id, targetDate);
                      onClose();
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-center transition-colors hover:border-blue-800 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    <span className="block text-xs font-semibold text-blue-900 whitespace-nowrap">
                      {preset.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                      {formatShortDate(targetDate)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="extend-custom-date"
              className="block text-xs font-medium text-slate-700"
            >
              Or choose a specific date
            </label>
            <input
              id="extend-custom-date"
              type="date"
              required
              min={today}
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
            >
              Update Due Date
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
