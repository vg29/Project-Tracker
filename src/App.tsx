import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  LayoutGrid,
  List,
  Menu,
  Plus,
  Search,
} from 'lucide-react';
import { DEFAULT_PROFILE } from './data/seed';
import {
  addD1CustomDoc,
  CoreDocSlotKey,
  createD1Project,
  createD1Task,
  D1UserRecord,
  deleteD1Project,
  deleteD1Task,
  getCurrentSessionUser,
  loadD1Workspace,
  logoutD1User,
  removeD1CoreDoc,
  removeD1DocById,
  resetD1Workspace,
  saveD1UserProfile,
  toggleD1TaskArchive,
  updateD1Project,
  updateD1Task,
  updateD1TaskDueDate,
  updateD1TaskStatus,
  upsertD1CoreDoc,
} from './services/d1Api';
import { uploadFileToR2 } from './services/r2Storage';
import {
  ExecutiveProfile,
  Project,
  Task,
  TaskDisplayMode,
  TaskStatus,
  WorkspaceView,
} from './types';
import { isDueWithinDays } from './utils/date';
import { countProjectDocuments } from './utils/documents';
import { downloadProjectTasksExcel } from './utils/exportExcel';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { TaskBoard } from './components/TaskBoard';
import { ProjectsGrid } from './components/ProjectsGrid';
import { TaskModal } from './components/TaskModal';
import { ProjectModal } from './components/ProjectModal';
import { ProfileModal } from './components/ProfileModal';
import { ProjectDocuments } from './components/ProjectDocuments';
import { ExtendDueDateModal } from './components/ExtendDueDateModal';

export default function App() {
  const [user, setUser] = useState<D1UserRecord | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

  const [profile, setProfile] = useState<ExecutiveProfile>(DEFAULT_PROFILE);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [activeView, setActiveView] = useState<WorkspaceView>('tasks');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<'tasks' | 'documents'>('tasks');
  const [displayMode, setDisplayMode] = useState<TaskDisplayMode>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [extendingTask, setExtendingTask] = useState<Task | null>(null);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    const data = await loadD1Workspace();
    setProfile(data.profile);
    setProjects(data.projects);
    setTasks(data.tasks);
    setWorkspaceReady(true);
    setWorkspaceError('');
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sessionUser = await getCurrentSessionUser();
        if (!active) return;
        setUser(sessionUser);
        if (sessionUser) {
          await refreshWorkspace();
        }
      } catch (err) {
        if (!active) return;
        setUser(null);
        setWorkspaceError(
          err instanceof Error ? err.message : 'Unable to connect to Cloudflare D1.'
        );
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshWorkspace]);

  const handleAuthenticated = async (authenticatedUser: D1UserRecord) => {
    setWorkspaceReady(false);
    setWorkspaceError('');
    setUser(authenticatedUser);
    await refreshWorkspace();
  };

  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {};
    for (const p of projects) {
      map[p.id] = p;
    }
    return map;
  }, [projects]);

  const activeProject = selectedProjectId
    ? projectsById[selectedProjectId] ?? null
    : null;

  const stats = useMemo(() => {
    const scoped = (
      selectedProjectId
        ? tasks.filter((t) => t.projectId === selectedProjectId)
        : tasks
    ).filter((t) => !t.archived);

    const open = scoped.filter((t) => t.status !== 'done').length;
    const inProgress = scoped.filter((t) => t.status === 'in_progress').length;
    const dueThisWeek = scoped.filter(
      (t) => t.status !== 'done' && isDueWithinDays(t.dueDate, 7)
    ).length;
    const completed = scoped.filter((t) => t.status === 'done').length;

    return { open, inProgress, dueThisWeek, completed };
  }, [tasks, selectedProjectId]);

  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        if (activeView === 'archived') {
          if (!task.archived) return false;
        } else {
          if (task.archived) return false;
          if (activeView === 'completed') {
            if (task.status !== 'done') return false;
          } else if (activeView === 'tasks') {
            if (selectedProjectId && task.projectId !== selectedProjectId) {
              return false;
            }
            if (displayMode === 'list') {
              if (statusFilter === 'all' && task.status === 'done') return false;
              if (statusFilter === 'todo' && task.status !== 'todo') return false;
              if (statusFilter === 'in_progress' && task.status !== 'in_progress') {
                return false;
              }
            }
          }
        }

        if (q) {
          const projectName = projectsById[task.projectId]?.name.toLowerCase() ?? '';
          const matches =
            task.title.toLowerCase().includes(q) ||
            task.refNo.toLowerCase().includes(q) ||
            projectName.includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      });
  }, [
    tasks,
    activeView,
    selectedProjectId,
    displayMode,
    statusFilter,
    searchQuery,
    projectsById,
  ]);

  const handleSelectView = (
    view: WorkspaceView,
    projectId: string | null = null,
    tab: 'tasks' | 'documents' = 'tasks'
  ) => {
    setActiveView(view);
    setSelectedProjectId(projectId);
    setProjectTab(tab);
    if (view === 'tasks') {
      setStatusFilter('all');
    }
  };

  const runWorkspaceMutation = (action: () => Promise<void>) => {
    void (async () => {
      try {
        setWorkspaceError('');
        await action();
        await refreshWorkspace();
      } catch (err) {
        setWorkspaceError(
          err instanceof Error ? err.message : 'Unable to save changes to Cloudflare D1.'
        );
      }
    })();
  };

  const handleToggleDone = (taskId: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    runWorkspaceMutation(() => updateD1TaskStatus(taskId, nextStatus));
  };

  const handleChangeStatus = (taskId: string, status: TaskStatus) => {
    if (!user) return;
    runWorkspaceMutation(() => updateD1TaskStatus(taskId, status));
  };

  const handleSaveTask = (
    data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>,
    existingId?: string
  ) => {
    if (!user) return;
    runWorkspaceMutation(() =>
      existingId ? updateD1Task(existingId, data) : createD1Task(data)
    );
  };

  const handleToggleArchiveTask = (taskId: string) => {
    if (!user) return;
    runWorkspaceMutation(() => toggleD1TaskArchive(taskId));
  };

  const handleExtendDueDate = (taskId: string, newDueDate: string) => {
    if (!user) return;
    runWorkspaceMutation(() => updateD1TaskDueDate(taskId, newDueDate));
  };

  const handleDeleteTask = (taskId: string) => {
    if (!user) return;
    runWorkspaceMutation(() => deleteD1Task(taskId));
  };

  const handleSaveProject = (
    data: Omit<Project, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (!user) return;
    runWorkspaceMutation(() =>
      existingId
        ? updateD1Project(existingId, {
            name: data.name,
            code: data.code,
            division: data.division,
            purchaseOrder: data.purchaseOrder,
          })
        : createD1Project({
            name: data.name,
            code: data.code,
            division: data.division,
            purchaseOrder: data.purchaseOrder,
          })
    );
  };

  const handleDeleteProject = (projectId: string) => {
    if (!user) return;
    runWorkspaceMutation(async () => {
      await deleteD1Project(projectId);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
    });
  };

  const handleUploadCoreDoc = async (
    projectId: string,
    slotKey: CoreDocSlotKey,
    label: string,
    file: File
  ) => {
    if (!user) return;
    const uploaded = await uploadFileToR2(file, {
      userId: user.id,
      projectId,
      slotKey,
    });
    await upsertD1CoreDoc(projectId, slotKey, label, uploaded);
    await refreshWorkspace();
  };

  const handleRemoveCoreDoc = async (
    projectId: string,
    slotKey: CoreDocSlotKey
  ) => {
    if (!user) return;
    await removeD1CoreDoc(projectId, slotKey);
    await refreshWorkspace();
  };

  const handleAddCustomDoc = async (
    projectId: string,
    label: string,
    file: File
  ) => {
    if (!user) return;
    const uploaded = await uploadFileToR2(file, {
      userId: user.id,
      projectId,
      slotKey: 'custom',
    });
    await addD1CustomDoc(projectId, label, uploaded);
    await refreshWorkspace();
  };

  const handleRemoveCustomDoc = async (docId: string) => {
    if (!user) return;
    await removeD1DocById(docId);
    await refreshWorkspace();
  };

  const handleSaveProfile = (nextProfile: ExecutiveProfile) => {
    if (!user) return;
    runWorkspaceMutation(() => saveD1UserProfile(nextProfile));
  };

  const handleResetWorkspace = () => {
    if (!user) return;
    runWorkspaceMutation(async () => {
      await resetD1Workspace();
      setActiveView('tasks');
      setSelectedProjectId(null);
      setSearchQuery('');
      setStatusFilter('all');
    });
  };

  const handleSignOut = () => {
    void (async () => {
      await logoutD1User();
      setUser(null);
      setWorkspaceReady(false);
      setWorkspaceError('');
      setProjects([]);
      setTasks([]);
      setProfile(DEFAULT_PROFILE);
      setActiveView('tasks');
      setSelectedProjectId(null);
    })();
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm font-medium text-slate-500">Loading workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onAuthenticated={(loggedInUser) => {
          void handleAuthenticated(loggedInUser);
        }}
      />
    );
  }

  const pageTitle =
    activeView === 'projects'
      ? 'Station Projects'
      : activeView === 'completed'
      ? 'Completed Tasks'
      : activeView === 'archived'
      ? 'Archived Tasks'
      : activeProject
      ? activeProject.name
      : 'My Tasks';

  const breadcrumbTrail =
    activeView === 'projects'
      ? 'Workspace / Projects'
      : activeView === 'completed'
      ? 'Workspace / Completed'
      : activeView === 'archived'
      ? 'Workspace / Archived'
      : activeProject
      ? `Projects / ${activeProject.code || activeProject.name}`
      : 'Workspace / My Tasks';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeView={activeView}
        selectedProjectId={selectedProjectId}
        projects={projects}
        tasks={tasks}
        profile={profile}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectView={handleSelectView}
        onOpenNewProject={() => {
          setEditingProject(null);
          setProjectModalOpen(true);
        }}
        onOpenProfile={() => setProfileModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="truncate text-sm font-medium text-slate-600">
              {breadcrumbTrail}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingTask(null);
              setTaskModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Task
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8">
          {workspaceError && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
            >
              <span>{workspaceError}</span>
              <button
                type="button"
                onClick={() => setWorkspaceError('')}
                className="shrink-0 font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
              {pageTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {profile.designation}
              <span className="mx-2" aria-hidden="true">·</span>
              <span>{profile.station}</span>
              {activeProject && (
                <>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span>{activeProject.division}</span>
                </>
              )}
            </p>
          </div>

          {activeView === 'tasks' && activeProject && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
              <div
                role="tablist"
                aria-label="Project workspace sections"
                className="flex items-center gap-6"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={projectTab === 'tasks'}
                  onClick={() => setProjectTab('tasks')}
                  className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                    projectTab === 'tasks'
                      ? 'border-blue-900 text-blue-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tasks
                  <span className="ml-2 font-mono text-xs tabular-nums text-slate-400">
                    {stats.open}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={projectTab === 'documents'}
                  onClick={() => setProjectTab('documents')}
                  className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                    projectTab === 'documents'
                      ? 'border-blue-900 text-blue-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Documents
                  <span className="ml-2 font-mono text-xs tabular-nums text-slate-400">
                    {countProjectDocuments(activeProject)}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => downloadProjectTasksExcel(activeProject, tasks)}
                className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                Download Excel
              </button>
            </div>
          )}

          {!(activeView === 'tasks' && activeProject && projectTab === 'documents') && (
            <section
              aria-label="Task summary"
              className="mb-6 grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0"
            >
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Open Tasks</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                  {stats.open}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">In Progress</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-700">
                  {stats.inProgress}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Due This Week</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-blue-900">
                  {stats.dueThisWeek}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Completed</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
                  {stats.completed}
                </p>
              </div>
            </section>
          )}

          {activeView !== 'projects' &&
            !(activeView === 'tasks' && activeProject && projectTab === 'documents') && (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="relative w-full sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks or file ref..."
                    aria-label="Search tasks or file reference"
                    className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                  />
                </div>

                {activeView === 'tasks' && displayMode === 'list' && (
                  <div
                    role="group"
                    aria-label="Filter tasks by status"
                    className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                        statusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('todo')}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                        statusFilter === 'todo'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      To Do
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('in_progress')}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                        statusFilter === 'in_progress'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      In Progress
                    </button>
                  </div>
                )}
              </div>

              {activeView === 'tasks' && (
                <div
                  role="group"
                  aria-label="Task view mode"
                  className="inline-flex items-center self-start rounded-md border border-slate-200 bg-slate-100 p-0.5 sm:self-auto"
                >
                  <button
                    type="button"
                    onClick={() => setDisplayMode('list')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                      displayMode === 'list'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" aria-hidden="true" />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('board')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                      displayMode === 'board'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                    Board
                  </button>
                </div>
              )}
            </div>
          )}

          {!workspaceReady ? (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
              <p className="text-sm text-slate-500">Loading your station workspace...</p>
            </div>
          ) : activeView === 'projects' ? (
            <ProjectsGrid
              projects={projects}
              tasks={tasks}
              onOpenProjectTasks={(projectId) => handleSelectView('tasks', projectId, 'tasks')}
              onOpenProjectDocuments={(projectId) =>
                handleSelectView('tasks', projectId, 'documents')
              }
              onDownloadProjectTasks={(project) =>
                downloadProjectTasksExcel(project, tasks)
              }
              onEditProject={(project) => {
                setEditingProject(project);
                setProjectModalOpen(true);
              }}
              onDeleteProject={handleDeleteProject}
              onNewProject={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
            />
          ) : activeView === 'tasks' && activeProject && projectTab === 'documents' ? (
            <ProjectDocuments
              project={activeProject}
              onUploadCoreDoc={(slotKey, label, file) =>
                handleUploadCoreDoc(activeProject.id, slotKey, label, file)
              }
              onRemoveCoreDoc={(slotKey) =>
                handleRemoveCoreDoc(activeProject.id, slotKey)
              }
              onAddCustomDoc={(label, file) =>
                handleAddCustomDoc(activeProject.id, label, file)
              }
              onRemoveCustomDoc={(docId) =>
                handleRemoveCustomDoc(docId)
              }
            />
          ) : activeView === 'tasks' && displayMode === 'board' ? (
            <TaskBoard
              tasks={visibleTasks}
              projectsById={projectsById}
              onChangeStatus={handleChangeStatus}
              onExtendDueDate={(task) => setExtendingTask(task)}
              onToggleArchive={handleToggleArchiveTask}
              onDeleteTask={handleDeleteTask}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
            />
          ) : (
            <TaskList
              tasks={visibleTasks}
              projectsById={projectsById}
              emptyTitle={
                searchQuery
                  ? 'No matching tasks'
                  : activeView === 'completed'
                  ? 'No completed tasks yet'
                  : activeView === 'archived'
                  ? 'No archived tasks'
                  : 'All caught up'
              }
              emptyDescription={
                searchQuery
                  ? 'Try clearing your search filter or switching to All Active.'
                  : activeView === 'completed'
                  ? 'Tasks marked Done will appear here for shift reference and audit history.'
                  : activeView === 'archived'
                  ? 'Archived tasks are tucked away here. You can restore or permanently delete them anytime.'
                  : 'No open tasks in this view. Add a new task to track your next station action.'
              }
              onToggleDone={handleToggleDone}
              onChangeStatus={handleChangeStatus}
              onExtendDueDate={(task) => setExtendingTask(task)}
              onToggleArchive={handleToggleArchiveTask}
              onDeleteTask={handleDeleteTask}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
              onNewTask={
                activeView === 'tasks' && !searchQuery
                  ? () => {
                      setEditingTask(null);
                      setTaskModalOpen(true);
                    }
                  : undefined
              }
            />
          )}
        </main>
      </div>

      <TaskModal
        open={taskModalOpen}
        task={editingTask}
        projects={projects}
        defaultProjectId={selectedProjectId}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTask}
        onToggleArchive={handleToggleArchiveTask}
        onDelete={handleDeleteTask}
      />

      <ExtendDueDateModal
        task={extendingTask}
        onClose={() => setExtendingTask(null)}
        onExtend={handleExtendDueDate}
      />

      <ProjectModal
        open={projectModalOpen}
        project={editingProject}
        onClose={() => setProjectModalOpen(false)}
        onUploadPurchaseOrder={(file, existingProjectId) => {
          if (!user) {
            return Promise.reject(new Error('Please sign in to upload files.'));
          }
          return uploadFileToR2(file, {
            userId: user.id,
            projectId: existingProjectId || 'new-project',
            slotKey: 'purchaseOrder',
          });
        }}
        onSave={handleSaveProject}
      />

      <ProfileModal
        open={profileModalOpen}
        profile={profile}
        onClose={() => setProfileModalOpen(false)}
        onSave={handleSaveProfile}
        onResetWorkspace={handleResetWorkspace}
      />
    </div>
  );
}
