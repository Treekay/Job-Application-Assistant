import { priorities, statuses } from "../constants/workflow";
import type { ApplicationPriority, ApplicationStatus, WorkflowApplication } from "../types/workflow";
import { formatDate } from "../utils/format";

export function ApplicationCard({
  application,
  onOpen,
  onStatus,
  onPriority,
  onDelete
}: {
  application: WorkflowApplication;
  onOpen: (application: WorkflowApplication) => void;
  onStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  onPriority: (id: string, priority: ApplicationPriority) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <article className="workflowApplicationCard">
      <button type="button" onClick={() => onOpen(application)}>
        <strong>{application.companyName} - {application.roleTitle}</strong>
        <span>{application.source || "Manual"} - {formatDate(application.deadline)}</span>
        {application.jobUrl ? <small>{application.jobUrl}</small> : null}
      </button>
      <select value={application.status} onChange={(event) => onStatus(application.id, event.target.value as ApplicationStatus)}>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <select value={application.priority} onChange={(event) => onPriority(application.id, event.target.value as ApplicationPriority)}>
        {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
      </select>
      <button type="button" className="dangerAction" onClick={() => onDelete(application.id)}>Delete</button>
    </article>
  );
}
