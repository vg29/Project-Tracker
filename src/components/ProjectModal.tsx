import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { FileText, Trash2, Upload, X } from 'lucide-react';
import {
  deleteFileFromR2,
  getProjectFileHref,
  MAX_R2_FILE_BYTES,
} from '../services/r2Storage';
import { Project, ProjectFile, PurchaseOrderDoc } from '../types';

interface ProjectModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onUploadPurchaseOrder: (file: File, existingProjectId?: string) => Promise<ProjectFile>;
  onSave: (data: Omit<Project, 'id' | 'createdAt'>, existingId?: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const DIVISION_OPTIONS = ['Application', 'Data Center', 'SOC', 'IT AMC'] as const;

export function ProjectModal({
  open,
  project,
  onClose,
  onUploadPurchaseOrder,
  onSave,
}: ProjectModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [division, setDivision] = useState<string>(DIVISION_OPTIONS[0]);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDoc | undefined>(
    undefined
  );
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionUploadedKeysRef = useRef<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setFileError('');
    setUploadingFile(false);
    sessionUploadedKeysRef.current = [];
    if (project) {
      setName(project.name);
      setCode(project.code);
      setDivision(
        DIVISION_OPTIONS.includes(project.division as (typeof DIVISION_OPTIONS)[number])
          ? project.division
          : DIVISION_OPTIONS[0]
      );
      setPurchaseOrder(project.purchaseOrder);
    } else {
      setName('');
      setCode('');
      setDivision(DIVISION_OPTIONS[0]);
      setPurchaseOrder(undefined);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [open, project]);

  const handleCancel = () => {
    const originalKey = project?.purchaseOrder?.r2Key;
    const keysToDiscard = sessionUploadedKeysRef.current.filter(
      (k) => k !== originalKey
    );
    for (const key of keysToDiscard) {
      void deleteFileFromR2(key);
    }
    sessionUploadedKeysRef.current = [];
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (!open) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_R2_FILE_BYTES) {
      setFileError('File exceeds 25 MB limit. Please upload a smaller document.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileError('');
    setUploadingFile(true);
    try {
      const uploaded = await onUploadPurchaseOrder(file, project?.id);
      if (uploaded.r2Key) {
        sessionUploadedKeysRef.current.push(uploaded.r2Key);
      }
      if (
        purchaseOrder?.r2Key &&
        purchaseOrder.r2Key !== project?.purchaseOrder?.r2Key &&
        purchaseOrder.r2Key !== uploaded.r2Key
      ) {
        void deleteFileFromR2(purchaseOrder.r2Key);
      }
      setPurchaseOrder(uploaded);
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : 'Could not upload Purchase order to Cloudflare R2.'
      );
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    if (
      purchaseOrder?.r2Key &&
      purchaseOrder.r2Key !== project?.purchaseOrder?.r2Key
    ) {
      void deleteFileFromR2(purchaseOrder.r2Key);
    }
    setPurchaseOrder(undefined);
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || uploadingFile) return;
    sessionUploadedKeysRef.current = [];
    onSave(
      {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        division: division.trim() || DIVISION_OPTIONS[0],
        purchaseOrder,
      },
      project?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2
            id="project-modal-title"
            className="font-display text-base font-semibold text-slate-900"
          >
            {project ? 'Edit Project' : 'New Station Project'}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs font-medium text-slate-700"
            >
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="project-code"
                className="block text-xs font-medium text-slate-700"
              >
                Project Code
              </label>
              <input
                id="project-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              />
            </div>

            <div>
              <label
                htmlFor="project-division"
                className="block text-xs font-medium text-slate-700"
              >
                Wing / Division
              </label>
              <select
                id="project-division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
              >
                {DIVISION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="project-purchase-order"
              className="block text-xs font-medium text-slate-700"
            >
              Purchase order
            </label>

            <input
              ref={fileInputRef}
              id="project-purchase-order"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => {
                void handleFileChange(e);
              }}
              className="sr-only"
            />

            {purchaseOrder ? (
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText
                    className="h-4 w-4 shrink-0 text-blue-900"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <a
                      href={getProjectFileHref(purchaseOrder)}
                      download={purchaseOrder.fileName}
                      className="block truncate text-xs font-medium text-slate-900 hover:text-blue-900 hover:underline"
                    >
                      {purchaseOrder.fileName}
                    </a>
                    <p className="font-mono text-[11px] tabular-nums text-slate-500">
                      {formatFileSize(purchaseOrder.fileSize)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-900 hover:bg-slate-200/70 disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    {uploadingFile ? 'Uploading...' : 'Replace'}
                  </button>
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={handleRemoveFile}
                    aria-label="Remove Purchase order document"
                    title="Remove document"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-800 hover:bg-slate-50 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
              >
                <Upload className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>
                  {uploadingFile
                    ? 'Uploading Purchase order...'
                    : 'Upload Purchase order (PDF, DOC, JPG, PNG · max 25 MB)'}
                </span>
              </button>
            )}

            {fileError && (
              <p className="mt-1.5 text-xs text-red-600" role="alert">
                {fileError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadingFile}
              className="rounded-md bg-blue-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
            >
              {project ? 'Save Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
