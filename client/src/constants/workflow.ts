import type { ApplicationPriority, ApplicationStatus } from "../types/workflow";

export const statuses: ApplicationStatus[] = ["Saved", "Applied", "Interview", "Offer", "Rejected"];
export const priorities: ApplicationPriority[] = ["High", "Medium", "Low"];

export const emptyApplication = {
  companyName: "",
  roleTitle: "",
  jobUrl: "",
  jobDescription: "",
  source: "Seek",
  priority: "Medium" as ApplicationPriority,
  deadline: "",
  notes: ""
};

export type ApplicationDraft = typeof emptyApplication & { cvDocumentId?: string };
