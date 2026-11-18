import { useState } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  FolderKanban,
  Archive,
  Plus,
  Plane,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { ExecutiveProfile, Project, Task, WorkspaceView } from '../types';

interface SidebarProps {
  activeView: WorkspaceView;
  selectedProjectId: string | null;
  projects: Project[];
  tasks: Task[];
  profile: ExecutiveProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (view: WorkspaceView, projectId?: string | null) => void;
  onOpenNewProject: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

const AVATAR_URL = '/src/assets/images/avatar_aai_executive_1794900614641.jpg';

export function Sidebar({
  activeView,
  selectedProjectId,
  projects,
  tasks,
  profile,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onOpenNewProject,
  onOpenProfile,
  onSignOut,
}: SidebarProps) {
  const [imgError, setImgError] = useState(false);

  const activeTaskCount = tasks.filter(
    (t) => !t.archived && t.status !== 'done'
  ).length;
  const completedTaskCount = tasks.filter(
    (t) => !t.archived && t.status === 'done'
  ).length;
  const archivedTaskCount = tasks.filter((t) => Boolean(t.archived)).length;

  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <button
          type="button"
          onClick={() => {
            onSelectView('tasks', null);
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded-md"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-900 text-white">
            <Plane className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-display text-sm font-bold leading-tight tracking-tight text-slate-900">
            AAI Desk — Project Tracker
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <nav aria-label="Primary workspace" className="space-y-1">
          <button
            type="button"
            onClick={() => {
              onSelectView('tasks', null);
              onCloseMobile();
            }}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
              activeView === 'tasks' && selectedProjectId === null
                ? 'bg-slate-100 text-blue-900'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CheckSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>My Tasks</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {activeTaskCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectView('projects', null);
              onCloseMobile();
            }}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
              activeView === 'projects'
                ? 'bg-slate-100 text-blue-900'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FolderKanban className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Projects</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {projects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectView('completed', null);
              onCloseMobile();
            }}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
              activeView === 'completed'
                ? 'bg-slate-100 text-blue-900'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Completed</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {completedTaskCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectView('archived', null);
              onCloseMobile();
            }}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
              activeView === 'archived'
                ? 'bg-slate-100 text-blue-900'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Archived</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {archivedTaskCount}
            </span>
          </button>
        </nav>

        <div className="mt-7 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between px-3 pb-2">
            <h2 className="text-xs font-semibold text-slate-500">
              Station Projects
            </h2>
            <button
              type="button"
              onClick={() => {
                onOpenNewProject();
                onCloseMobile();
              }}
              aria-label="Add project"
              title="New Project"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {projects.map((project) => {
              const openCount = tasks.filter(
                (t) => t.projectId === project.id && !t.archived && t.status !== 'done'
              ).length;
              const isSelected =
                activeView === 'tasks' && selectedProjectId === project.id;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    onSelectView('tasks', project.id);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                    isSelected
                      ? 'bg-slate-100 font-medium text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate pr-2">{project.name}</span>
                  <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
                    {openCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => {
            onOpenProfile();
            onCloseMobile();
          }}
          className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
        >
          {!imgError ? (
            <img
              src={AVATAR_URL}
              alt={profile.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-9 w-9 shrink-0 rounded-md object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-900 font-display text-xs font-semibold text-white">
              {initials || 'JE'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {profile.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {profile.station}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onSignOut();
          }}
          className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block lg:shrink-0">{sidebarContent}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
