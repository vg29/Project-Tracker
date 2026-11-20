import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { CoreDocSlotKey } from '../services/d1Api';
import { getProjectFileHref, MAX_R2_FILE_BYTES } from '../services/r2Storage';
import { Project, ProjectFile } from '../types';
import { countCoreDocuments } from '../utils/documents';
import { formatShortDate } from '../utils/date';

interface ProjectDocumentsProps {
  project: Project;
  onUploadCoreDoc: (slotKey: CoreDocSlotKey, label: string, file: File) => Promise<void>;
  onRemoveCoreDoc: (slotKey: CoreDocSlotKey) => Promise<void>;
  onAddCustomDoc: (label: string, file: File) => Promise<void>;
  onRemoveCustomDoc: (docId: string) => Promise<void>;
}

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

const CORE_DOCUMENT_SLOTS: {
  key: CoreDocSlotKey;
  indexLabel: string;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'rfp',
    indexLabel: '01.',
    title: 'RFP',
    subtitle: 'Request for Proposal and technical tender specification.',
  },
  {
    key: 'eOfficeFile',
    indexLabel: '02.',
    title: 'eOffice File',
    subtitle: 'eOffice file noting, approval sheet, or movement extract.',
  },
  {
    key: 'agreement',
    indexLabel: '03.',
    title: 'Agreement',
    subtitle: 'Signed contract agreement or memorandum with vendor.',
  },
  {
    key: 'purchaseOrder',
    indexLabel: '04.',
    title: 'PO',
    subtitle: 'Issued Purchase Order (synced with project details).',
  },
  {
    key: 'bg',
    indexLabel: '05.',
    title: 'BG',
    subtitle: 'Bank Guarantee / Performance Security document.',
  },
  {
    key: 'ip',
    indexLabel: '06.',
    title: 'IP',
    subtitle: 'Integrity Pact / Implementation record.',
  },
  {
    key: 'bills',
    indexLabel: '07.',
    title: 'Bills',
    subtitle: 'Vendor invoices, tax bills, and payment verification sheets.',
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface DocumentSlotRowProps {
  indexLabel: string;
  title: string;
  subtitle: string;
  doc?: ProjectFile;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  onError: (msg: string) => void;
}

function DocumentSlotRow({
  indexLabel,
  title,
  subtitle,
  doc,
  uploading,
  onUpload,
  onRemove,
  onError,
}: DocumentSlotRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onError('');

    if (file.size > MAX_R2_FILE_BYTES) {
      onError('File exceeds 25 MB limit. Please upload a smaller document.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    try {
      await onUpload(file);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'Failed to upload document to Cloudflare R2.'
      );
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fileHref = doc ? getProjectFileHref(doc) : '#';

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-slate-400">
            {indexLabel}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {doc ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Uploaded
            </span>
          ) : (
            <span className="text-xs text-slate-400">Pending</span>
          )}
        </div>

        {doc ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <a
              href={fileHref}
              download={doc.fileName}
              className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-xs truncate">{doc.fileName}</span>
            </a>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{formatFileSize(doc.fileSize)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Uploaded {formatShortDate(doc.uploadedAt)}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={(e) => {
          void handleChange(e);
        }}
        className="sr-only"
        aria-label={`Upload ${title}`}
      />

      <div className="flex shrink-0 items-center gap-2">
        {doc ? (
          <>
            <a
              href={fileHref}
              download={doc.fileName}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download
            </a>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              {uploading ? 'Uploading...' : 'Replace'}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                void onRemove();
              }}
              aria-label={`Remove ${title}`}
              title={`Remove ${title}`}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {uploading ? 'Uploading...' : `Upload ${title}`}
          </button>
        )}
      </div>
    </li>
  );
}

export function ProjectDocuments({
  project,
  onUploadCoreDoc,
  onRemoveCoreDoc,
  onAddCustomDoc,
  onRemoveCustomDoc,
}: ProjectDocumentsProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingSlot, setUploadingSlot] = useState<CoreDocSlotKey | null>(null);
  const [uploadingCustom, setUploadingCustom] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  const otherDocs = project.otherDocuments ?? [];
  const coreUploadedCount = countCoreDocuments(project);

  const handleCustomFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    if (file.size > MAX_R2_FILE_BYTES) {
      setErrorMsg('File exceeds 25 MB limit. Please upload a smaller document.');
      if (customInputRef.current) customInputRef.current.value = '';
      return;
    }

    setPendingFile(file);
    if (!customLabel.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setCustomLabel(baseName);
    }
  };

  const handleAddCustomDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim() || !pendingFile) return;

    setErrorMsg('');
    setUploadingCustom(true);
    try {
      await onAddCustomDoc(customLabel.trim(), pendingFile);
      setCustomLabel('');
      setPendingFile(null);
      setShowAddForm(false);
      if (customInputRef.current) customInputRef.current.value = '';
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to upload document to Cloudflare R2.'
      );
    } finally {
      setUploadingCustom(false);
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
        >
          {errorMsg}
        </div>
      )}

      <section
        aria-label="Project documents"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Project Documents
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Accepted formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG · max 25 MB per file
            </p>
          </div>
          <span className="font-mono text-xs font-medium tabular-nums text-slate-600">
            {coreUploadedCount} / {CORE_DOCUMENT_SLOTS.length} uploaded
          </span>
        </div>

        <ul className="divide-y divide-slate-200">
          {CORE_DOCUMENT_SLOTS.map((slot) => (
            <DocumentSlotRow
              key={slot.key}
              indexLabel={slot.indexLabel}
              title={slot.title}
              subtitle={slot.subtitle}
              doc={project[slot.key]}
              uploading={uploadingSlot === slot.key}
              onUpload={async (file) => {
                setUploadingSlot(slot.key);
                try {
                  await onUploadCoreDoc(slot.key, slot.title, file);
                } finally {
                  setUploadingSlot(null);
                }
              }}
              onRemove={() => onRemoveCoreDoc(slot.key)}
              onError={setErrorMsg}
            />
          ))}
        </ul>
      </section>

      <section
        aria-label="Additional project documents"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Additional Documents &amp; Extra Bills
          </h2>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setShowAddForm(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Document
            </button>
          )}
        </div>

        {showAddForm && (
          <form
            onSubmit={(e) => {
              void handleAddCustomDocument(e);
            }}
            className="border-b border-slate-200 bg-slate-50/40 px-5 py-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label
                  htmlFor="custom-doc-label"
                  className="block text-xs font-medium text-slate-700"
                >
                  Document Name
                </label>
                <input
                  id="custom-doc-label"
                  type="text"
                  required
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g., RA Bill 2 or Completion Certificate"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-doc-file"
                  className="block text-xs font-medium text-slate-700"
                >
                  Document File
                </label>
                <input
                  ref={customInputRef}
                  id="custom-doc-file"
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleCustomFileChange}
                  className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={uploadingCustom}
                  onClick={() => {
                    setShowAddForm(false);
                    setCustomLabel('');
                    setPendingFile(null);
                    if (customInputRef.current) customInputRef.current.value = '';
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pendingFile || !customLabel.trim() || uploadingCustom}
                  className="rounded-md bg-blue-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  {uploadingCustom ? 'Uploading...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        )}

        {otherDocs.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            No additional documents uploaded for this project yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {otherDocs.map((item, idx) => {
              const itemHref = getProjectFileHref(item.file);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-slate-400">
                        {String(idx + CORE_DOCUMENT_SLOTS.length + 1).padStart(2, '0')}.
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <a
                        href={itemHref}
                        download={item.file.fileName}
                        className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="max-w-xs truncate">{item.file.fileName}</span>
                      </a>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatFileSize(item.file.fileSize)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Uploaded {formatShortDate(item.file.uploadedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={itemHref}
                      download={item.file.fileName}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void onRemoveCustomDoc(item.id);
                      }}
                      aria-label={`Remove ${item.label}`}
                      title={`Remove ${item.label}`}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
