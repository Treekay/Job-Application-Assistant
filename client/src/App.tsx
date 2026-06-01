import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  clearWorkflowToken,
  createWorkflowApplication,
  deleteWorkflowApplication,
  fetchWorkflowApplications,
  fetchWorkflowCvs,
  fetchWorkflowDashboard,
  fetchWorkflowMe,
  getWorkflowToken,
  updateWorkflowPriority,
  updateWorkflowStatus
} from "./api/workflowApi";
import type { ApplicationDraft } from "./constants/workflow";
import { AdminView } from "./pages/AdminView";
import { ApplicationsView } from "./pages/ApplicationsView";
import { AuthView } from "./pages/AuthView";
import { CvView } from "./pages/CvView";
import { DashboardView } from "./pages/DashboardView";
import type {
  ApplicationPriority,
  ApplicationStatus,
  WorkflowApplication,
  WorkflowDashboard,
  WorkflowUser
} from "./types/workflow";

type Page = "dashboard" | "applications" | "cvs" | "admin";

const pageTitles: Record<Page, string> = {
  dashboard: "Application progress dashboard",
  applications: "Create job application",
  cvs: "CV library",
  admin: "Admin console"
};

export function App() {
  const [user, setUser] = useState<WorkflowUser | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [applications, setApplications] = useState<WorkflowApplication[]>([]);
  const [dashboard, setDashboard] = useState<WorkflowDashboard | null>(null);
  const [cvs, setCvs] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const selectedApplication = useMemo(
    () => applications.find((item) => item.id === selectedId) || applications[0] || null,
    [applications, selectedId]
  );

  async function loadAll() {
    setError("");
    try {
      const [apps, stats, cvItems] = await Promise.all([
        fetchWorkflowApplications(),
        fetchWorkflowDashboard(),
        fetchWorkflowCvs()
      ]);
      setApplications(apps);
      setDashboard(stats);
      setCvs(cvItems);
      setSelectedId((current) => apps.some((app) => app.id === current) ? current : apps[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load workspace");
    }
  }

  useEffect(() => {
    async function boot() {
      if (!getWorkflowToken()) return;
      try {
        const me = await fetchWorkflowMe();
        setUser(me);
      } catch {
        clearWorkflowToken();
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  if (!user) {
    return <AuthView onAuthenticated={setUser} />;
  }

  async function createApplication(input: ApplicationDraft) {
    await createWorkflowApplication({
      ...input,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : undefined
    });
    await loadAll();
  }

  async function changeStatus(id: string, status: ApplicationStatus) {
    await updateWorkflowStatus(id, status);
    await loadAll();
  }

  async function changePriority(id: string, priority: ApplicationPriority) {
    await updateWorkflowPriority(id, priority);
    await loadAll();
  }

  async function removeApplication(id: string) {
    if (!window.confirm("Delete this application and its saved notes, documents, reminders, and match summary?")) {
      return;
    }

    await deleteWorkflowApplication(id);
    setSelectedId((current) => current === id ? "" : current);
    await loadAll();
  }

  function logout() {
    clearWorkflowToken();
    setUser(null);
    setApplications([]);
  }

  function openCreateApplication() {
    setPage("applications");
  }

  function returnToDashboard() {
    setPage("dashboard");
  }

  return (
    <main className="workflowShell">
      <aside className="workflowSidebar">
        <div className="workflowBrand">
          <Sparkles size={18} />
          <div><strong>JobWorkflow</strong><span>{user.displayName}</span></div>
        </div>
        <nav>
          <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>Dashboard</button>
          <button className={page === "applications" ? "active" : ""} onClick={openCreateApplication}>New Application</button>
          <button className={page === "cvs" ? "active" : ""} onClick={() => setPage("cvs")}>CV Library</button>
          <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>Admin</button>
        </nav>
        <button type="button" onClick={logout}>Logout</button>
      </aside>
      <section className="workflowContent">
        <header className="workflowHeader">
          <div>
            <span>Workflow SaaS</span>
            <h1>{pageTitles[page]}</h1>
          </div>
          <button type="button" onClick={loadAll}><RefreshCw size={16} /> Refresh</button>
        </header>
        {error ? <p className="workflowError">{error}</p> : null}
        {page === "dashboard" ? (
          <DashboardView
            applications={applications}
            cvs={cvs}
            dashboard={dashboard}
            selectedApplication={selectedApplication}
            onActionComplete={loadAll}
            onDelete={removeApplication}
            onPriority={changePriority}
            onRefresh={loadAll}
            onSelect={(application) => setSelectedId(application.id)}
            onStatus={changeStatus}
          />
        ) : null}
        {page === "applications" ? (
          <ApplicationsView
            cvs={cvs}
            onCreate={createApplication}
            onModeChange={returnToDashboard}
          />
        ) : null}
        {page === "cvs" ? <CvView cvs={cvs} onCreated={loadAll} /> : null}
        {page === "admin" ? <AdminView user={user} /> : null}
      </section>
    </main>
  );
}
