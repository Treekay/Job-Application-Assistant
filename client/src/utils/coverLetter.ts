import type { WorkflowApplication } from "../types/workflow";

export function buildCoverLetterDraft(application: WorkflowApplication, matchSummary?: string) {
  const company = application.companyName || "your team";
  const role = application.roleTitle || "this role";
  const fit = matchSummary
    ? `Based on the role requirements, my background appears most relevant in these areas: ${matchSummary}`
    : "Based on the role requirements, I would focus my application on the strongest overlap between my experience and the team's current needs.";

  return [
    `Hi ${company} team,`,
    "",
    `I hope you're doing well. I'm interested in the ${role} opportunity and wanted to briefly introduce myself.`,
    "",
    fit,
    "",
    "I'd appreciate the chance to discuss how my experience could contribute to the role. I'm happy to provide any further details and work around your schedule.",
    "",
    "Kind regards,"
  ].join("\n");
}
