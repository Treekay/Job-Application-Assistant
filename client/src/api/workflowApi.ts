import type {
  ApplicationPriority,
  ApplicationStatus,
  WorkflowApplication,
  WorkflowAuthResponse,
  WorkflowDocument,
  WorkflowDashboard,
  WorkflowMatchAnalysis
} from "../types/workflow";

const API_BASE_URL = import.meta.env.VITE_WORKFLOW_API_URL || "http://localhost:5043";
const TOKEN_KEY = "workflow_token";

export function getWorkflowToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setWorkflowToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearWorkflowToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getWorkflowToken();

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getWorkflowToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Request failed");
  }

  return response.blob();
}

export function registerWorkflowUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<WorkflowAuthResponse> {
  return requestJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function loginWorkflowUser(input: {
  email: string;
  password: string;
}): Promise<WorkflowAuthResponse> {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function forgotWorkflowPassword(email: string): Promise<{ message: string }> {
  return requestJson("/api/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function resetWorkflowPassword(input: {
  token: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return requestJson("/api/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchWorkflowMe(): Promise<import("../types/workflow").WorkflowUser> {
  return requestJson("/api/auth/me");
}

export function fetchWorkflowCvs(): Promise<Array<{ id: string; fileName: string; createdAt: string }>> {
  return requestJson("/api/cvs");
}

export function fetchWorkflowCv(id: string): Promise<{ id: string; fileName: string; content: string; createdAt: string }> {
  return requestJson(`/api/cvs/${id}`);
}

export function fetchWorkflowCvPdf(id: string): Promise<Blob> {
  return requestBlob(`/api/cvs/${id}/file`);
}

export function deleteWorkflowCv(id: string): Promise<void> {
  return requestJson(`/api/cvs/${id}`, {
    method: "DELETE"
  });
}

export function uploadWorkflowCv(file: File): Promise<{ id: string; fileName: string; createdAt: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson("/api/cvs/upload", {
    method: "POST",
    body: formData
  });
}

export function importWorkflowJob(url: string): Promise<{
  companyName: string;
  roleTitle: string;
  source: string;
  jobUrl: string;
  description: string;
}> {
  return requestJson("/api/job-imports", {
    method: "POST",
    body: JSON.stringify({ url })
  });
}

export function fetchWorkflowApplications(): Promise<WorkflowApplication[]> {
  return requestJson("/api/applications");
}

export function createWorkflowApplication(input: {
  companyName: string;
  roleTitle: string;
  jobUrl?: string;
  jobDescription?: string;
  source?: string;
  priority: ApplicationPriority;
  cvDocumentId?: string;
  deadline?: string;
  notes?: string;
}): Promise<WorkflowApplication> {
  return requestJson("/api/applications", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteWorkflowApplication(id: string): Promise<void> {
  return requestJson(`/api/applications/${id}`, {
    method: "DELETE"
  });
}

export function updateWorkflowApplication(
  id: string,
  input: {
    companyName: string;
    roleTitle: string;
    jobUrl?: string;
    jobDescription?: string;
    source?: string;
    priority: ApplicationPriority;
    cvDocumentId?: string;
    deadline?: string;
    notes?: string;
  }
): Promise<WorkflowApplication> {
  return requestJson(`/api/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function updateWorkflowStatus(
  id: string,
  status: ApplicationStatus,
  comment?: string
): Promise<WorkflowApplication> {
  return requestJson(`/api/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, comment })
  });
}

export function updateWorkflowPriority(
  id: string,
  priority: ApplicationPriority
): Promise<WorkflowApplication> {
  return requestJson(`/api/applications/${id}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority })
  });
}

export function fetchWorkflowDashboard(): Promise<WorkflowDashboard> {
  return requestJson("/api/dashboard");
}

export function addWorkflowDocument(
  id: string,
  input: { type: WorkflowDocument["type"]; title: string; content: string }
): Promise<void> {
  return requestJson(`/api/applications/${id}/documents`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function addWorkflowNote(id: string, body: string): Promise<void> {
  return requestJson(`/api/applications/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

export function addWorkflowReminder(
  id: string,
  input: { kind: "FollowUp" | "Interview" | "Deadline" | "Custom"; dueAt: string; message: string }
): Promise<void> {
  return requestJson(`/api/applications/${id}/reminders`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function generateWorkflowMatchSummary(
  id: string,
  jobDescription: string
): Promise<WorkflowMatchAnalysis> {
  return requestJson(`/api/applications/${id}/match-summary`, {
    method: "POST",
    body: JSON.stringify({ jobDescription })
  });
}

export function generateWorkflowCoverLetter(id: string): Promise<{ content: string }> {
  return requestJson(`/api/applications/${id}/cover-letter/draft`, {
    method: "POST"
  });
}

export function generateWorkflowEmail(id: string): Promise<{ content: string }> {
  return requestJson(`/api/applications/${id}/email/draft`, {
    method: "POST"
  });
}

export function fetchAdminUsers(): Promise<import("../types/workflow").WorkflowUser[]> {
  return requestJson("/api/admin/users");
}
