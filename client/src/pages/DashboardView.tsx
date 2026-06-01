import { useState } from "react";
import { ArrowLeft, BarChart3, Bell, BriefcaseBusiness, RefreshCw } from "lucide-react";
import { ApplicationCard } from "../components/ApplicationCard";
import { StatCard } from "../components/StatCard";
import { statuses } from "../constants/workflow";
import type { ApplicationPriority, ApplicationStatus, WorkflowApplication, WorkflowDashboard } from "../types/workflow";
import { formatDate } from "../utils/format";
import { ApplicationDetailView } from "./ApplicationDetailView";

export function DashboardView({
  applications,
  cvs,
  dashboard,
  selectedApplication,
  onRefresh,
  onSelect,
  onStatus,
  onPriority,
  onDelete,
  onActionComplete
}: {
  applications: WorkflowApplication[];
  cvs: Array<{ id: string; fileName: string; createdAt: string }>;
  dashboard: WorkflowDashboard | null;
  selectedApplication: WorkflowApplication | null;
  onRefresh: () => Promise<void>;
  onSelect: (application: WorkflowApplication) => void;
  onStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  onPriority: (id: string, priority: ApplicationPriority) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onActionComplete: () => Promise<void>;
}) {
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | "All">("All");
  const [viewMode, setViewMode] = useState<"tracker" | "detail">("tracker");
  const upcoming = applications
    .filter((item) => item.deadline)
    .sort((a, b) => new Date(a.deadline || "").getTime() - new Date(b.deadline || "").getTime())
    .slice(0, 5);
  const filteredApplications = selectedStatus === "All"
    ? applications
    : applications.filter((application) => application.status === selectedStatus);
  const statusFilters: Array<ApplicationStatus | "All"> = ["All", ...statuses];

  function openApplication(application: WorkflowApplication) {
    onSelect(application);
    setViewMode("detail");
  }

  if (viewMode === "detail") {
    return (
      <section className="workflowStack">
        <div className="panelTitle applicationToolbar">
          <button type="button" className="secondaryAction" onClick={() => setViewMode("tracker")}>
            <ArrowLeft size={16} />
            Back to tracker
          </button>
        </div>
        <ApplicationDetailView application={selectedApplication} cvs={cvs} onActionComplete={onActionComplete} />
      </section>
    );
  }

  return (
    <section className="workflowStack">
      <div className="workflowStats">
        <StatCard label="Total applications" value={dashboard?.totalApplications ?? applications.length} />
        <StatCard label="High priority" value={dashboard?.highPriorityCount ?? 0} />
        <StatCard label="Deadlines this week" value={dashboard?.deadlinesThisWeek ?? 0} />
        <StatCard label="Interview stage" value={dashboard?.byStatus?.Interview ?? 0} />
      </div>
      <section className="workflowPanel">
        <div className="panelTitle">
          <BarChart3 size={18} />
          <h2>Status progress</h2>
        </div>
        <div className="statusGrid">
          {statusFilters.map((status) => (
            <button
              className={selectedStatus === status ? "statusFilterCard active" : "statusFilterCard"}
              key={status}
              onClick={() => setSelectedStatus(status)}
              type="button"
            >
              <strong>{status === "All" ? applications.length : dashboard?.byStatus?.[status] ?? 0}</strong>
              <span>{status}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="workflowPanel">
        <div className="panelTitle">
          <RefreshCw size={18} />
          <h2>{selectedStatus === "All" ? "Application tracker" : `${selectedStatus} applications`}</h2>
          <button type="button" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="workflowList">
          {filteredApplications.length ? filteredApplications.map((application) => (
            <ApplicationCard
              application={application}
              key={application.id}
              onDelete={onDelete}
              onOpen={openApplication}
              onPriority={onPriority}
              onStatus={onStatus}
            />
          )) : (
            <div className="emptyTracker">
              <BriefcaseBusiness size={22} />
              <strong>No applications in this status</strong>
              <p className="workflowMuted">Switch to another status to continue reviewing your applications.</p>
            </div>
          )}
        </div>
      </section>
      <section className="workflowPanel">
        <div className="panelTitle">
          <Bell size={18} />
          <h2>Upcoming deadlines</h2>
        </div>
        {upcoming.length ? upcoming.map((item) => (
          <div className="deadlineRow" key={item.id}>
            <strong>{item.roleTitle}</strong>
            <span>{item.companyName} - {formatDate(item.deadline)}</span>
          </div>
        )) : <p className="workflowMuted">No deadlines yet.</p>}
      </section>
    </section>
  );
}
