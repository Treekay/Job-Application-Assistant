export type ApplicationStatus = "Saved" | "Applied" | "Interview" | "Offer" | "Rejected";
export type ApplicationPriority = "Low" | "Medium" | "High";
export type DocumentType = "Cv" | "CoverLetter" | "Email" | "Other";
export type ReminderKind = "FollowUp" | "Interview" | "Deadline" | "Custom";

export interface WorkflowUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface WorkflowAuthResponse {
  token: string;
  user: WorkflowUser;
}

export interface WorkflowApplication {
  id: string;
  companyName: string;
  roleTitle: string;
  jobUrl?: string;
  jobDescription?: string;
  source?: string;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  deadline?: string;
  matchSummary?: string;
  missingSkills?: string;
  notes?: string;
  cvDocumentId?: string;
  createdAt: string;
  updatedAt: string;
  documents: WorkflowDocument[];
  reminders: WorkflowReminder[];
}

export interface WorkflowDocument {
  id: string;
  type: DocumentType;
  title: string;
  updatedAt: string;
}

export interface WorkflowReminder {
  id: string;
  kind: ReminderKind;
  dueAt: string;
  isSent: boolean;
  message: string;
}

export interface WorkflowDashboard {
  totalApplications: number;
  byStatus: Record<string, number>;
  deadlinesThisWeek: number;
  highPriorityCount: number;
}
