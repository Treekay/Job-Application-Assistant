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
  matchAnalysis?: WorkflowMatchAnalysis;
  notes?: string;
  cvDocumentId?: string;
  createdAt: string;
  updatedAt: string;
  documents: WorkflowDocument[];
  reminders: WorkflowReminder[];
}

export interface WorkflowRequirementAnalysis {
  requirement: string;
  priority: "High" | "Medium" | "Low" | string;
  evidence: string;
  notes: string;
}

export interface WorkflowMatchAnalysis {
  summary: string;
  missingSkills: string;
  score: number;
  matchedRequirements: WorkflowRequirementAnalysis[];
  missingRequirements: WorkflowRequirementAnalysis[];
  evidence: string[];
  recommendations: string[];
  finalReport: string;
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
