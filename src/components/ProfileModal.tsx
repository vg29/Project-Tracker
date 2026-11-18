import { FormEvent, useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_DESIGNATION, DESIGNATION_OPTIONS } from '../data/seed';
import { ExecutiveProfile } from '../types';

interface ProfileModalProps {
  open: boolean;
  profile: ExecutiveProfile;
  onClose: () => void;
  onSave: (profile: ExecutiveProfile) => void;
  onResetWorkspace: () => void;
}

export function ProfileModal({
  open,
  profile,
  onClose,
  onSave,
  onResetWorkspace,
}: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [designation, setDesignation] = useState(
    (DESIGNATION_OPTIONS as readonly string[]).includes(profile.designation)
      ? profile.designation
      : DEFAULT_DESIGNATION
  );
  const [station, setStation] = useState(profile.station);
  const [employeeId, setEmployeeId] = useState(profile.employeeId);

  useEffect(() => {
    if (!open) return;
    setName(profile.name);
    setDesignation(
      (DESIGNATION_OPTIONS as readonly string[]).includes(profile.designation)
        ? profile.designation
        : DEFAULT_DESIGNATION
    );
    setStation(profile.station);
    setEmployeeId(profile.employeeId);
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      designation,
      station: station.trim() || 'AAI Station',
      employeeId: employeeId.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2
            id="profile-modal-title"
            className="font-display text-base font-semibold text-slate-900"
          >
            Executive Details
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
              htmlFor="exec-name"
              className="block text-xs font-medium text-slate-700"
            >
              Full Name
            </label>
            <input
              id="exec-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            />
          </div>

          <div>
            <label
              htmlFor="exec-designation"
              className="block text-xs font-medium text-slate-700"
            >
              Designation
            </label>
            <select
              id="exec-designation"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            >
              {DESIGNATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="exec-station"
                className="block text-xs font-medium text-slate-700"
              >
                Airport / Station
              </label>
              <input
                id="exec-station"
                type="text"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="e.g., VIDP · Terminal 3"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              />
            </div>

            <div>
              <label
                htmlFor="exec-id"
                className="block text-xs font-medium text-slate-700"
              >
                Employee ID
              </label>
              <input
                id="exec-id"
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="AAI-JE-4182"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                onResetWorkspace();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset Sample Data
            </button>

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
                Save Details
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
