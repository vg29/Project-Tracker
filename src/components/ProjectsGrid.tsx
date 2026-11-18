import { Pencil, Trash2, ArrowUpRight, Plus, FileText, Download } from 'lucide-react';
import { Project, Task } from '../types';
import { countProjectDocuments } from '../utils/documents';

interface ProjectsGridProps {
  projects: Project[];
  tasks: Task[];
  onOpenProjectTasks: (projectId: string) => void;
  onOpenProjectDocuments: (projectId: string) => void;
  onDownloadProjectTasks: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onNewProject: () => void;
}

export function ProjectsGrid({
  projects,
  tasks,
  onOpenProjectTasks,
  onOpenProjectDocuments,
  onDownloadProjectTasks,
  onEditProject,
  onDeleteProject,
  onNewProject,
}: ProjectsGridProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
        <p className="font-display text-base font-semibold text-slate-900">
          No station projects yet
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          Create a project to group recurring station inspections, audits, or terminal maintenance tasks.
        </p>
        <button
          type="button"
          onClick={onNewProject}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {projects.length} active station {projects.length === 1 ? 'project' : 'projects'}
        </p>
        <button
          type="button"
          onClick={onNewProject}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Project
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_8rem_9.5rem_10rem_7rem_7rem] items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-2.5 text-xs font-semibold text-slate-600 md:grid">
          <span>Project</span>
          <span>Code</span>
          <span>Division</span>
          <span>Documents</span>
          <span className="text-right">Progress</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y divide-slate-200">
          {projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.projectId === project.id);
            const doneCount = projectTasks.filter((t) => t.status === 'done').length;
            const totalCount = projectTasks.length;
            const docCount = countProjectDocuments(project);

            return (
              <li
                key={project.id}
                className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 md:grid md:grid-cols-[minmax(0,1.4fr)_8rem_9.5rem_10rem_7rem_7rem] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenProjectTasks(project.id)}
                    className="group inline-flex max-w-full items-center gap-1.5 text-left font-medium text-slate-900 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
                  >
                    <span className="truncate text-sm">{project.name}</span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-900"
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className="font-mono text-xs tabular-nums text-slate-600">
                  {project.code || '—'}
                </div>

                <div className="truncate text-xs text-slate-600">
                  {project.division || 'Station Operations'}
                </div>

                <div className="min-w-0 text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenProjectDocuments(project.id)}
                    className="inline-flex items-center gap-1.5 font-medium text-blue-900 hover:underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">
                      {docCount === 0
                        ? 'Upload docs'
                        : `${docCount} ${docCount === 1 ? 'document' : 'documents'}`}
                    </span>
                  </button>
                </div>

                <div className="text-left font-mono text-xs tabular-nums text-slate-700 md:text-right">
                  {doneCount} / {totalCount} done
                </div>

                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onDownloadProjectTasks(project)}
                    aria-label={`Download Excel tasks for ${project.name}`}
                    title="Download tasks (.xlsx)"
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditProject(project)}
                    aria-label={`Edit ${project.name}`}
                    title="Edit project"
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProject(project.id)}
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
