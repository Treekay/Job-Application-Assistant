import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  FileText,
  Lock,
  Mail,
  ArrowLeft,
  Plus,
  RefreshCw,
  Shield,
  Sparkles
} from "lucide-react";
import {
  addWorkflowDocument,
  addWorkflowNote,
  addWorkflowReminder,
  clearWorkflowToken,
  createWorkflowApplication,
  deleteWorkflowApplication,
  deleteWorkflowCv,
  fetchAdminUsers,
  fetchWorkflowApplications,
  fetchWorkflowCvPdf,
  fetchWorkflowCvs,
  fetchWorkflowDashboard,
  fetchWorkflowMe,
  forgotWorkflowPassword,
  generateWorkflowMatchSummary,
  getWorkflowToken,
  importWorkflowJob,
  loginWorkflowUser,
  registerWorkflowUser,
  resetWorkflowPassword,
  setWorkflowToken,
  uploadWorkflowCv,
  updateWorkflowPriority,
  updateWorkflowStatus
} from "./api/workflowApi";
import type {
  ApplicationPriority,
  ApplicationStatus,
  WorkflowApplication,
  WorkflowDashboard,
  WorkflowUser
} from "./types/workflow";

const statuses: ApplicationStatus[] = ["Saved", "Applied", "Interview", "Offer", "Rejected"];
const priorities: ApplicationPriority[] = ["High", "Medium", "Low"];

type AuthMode = "login" | "register" | "forgot" | "reset";
type Page = "dashboard" | "applications" | "cvs" | "admin";

const emptyApplication = {
  companyName: "",
  roleTitle: "",
  jobUrl: "",
  jobDescription: "",
  source: "Seek",
  priority: "Medium" as ApplicationPriority,
  deadline: "",
  notes: ""
};

function formatDate(value?: string) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function compactText(value?: string, maxLength = 520) {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function splitList(value?: string) {
  if (!value) return [];
  return value
    .replace(/[[\]"{}]/g, "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCoverLetterDraft(application: WorkflowApplication, matchSummary?: string) {
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

function AuthView({ onAuthenticated }: { onAuthenticated: (user: WorkflowUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const payload = await loginWorkflowUser({ email, password });
        setWorkflowToken(payload.token);
        onAuthenticated(payload.user);
      }
      if (mode === "register") {
        const payload = await registerWorkflowUser({ email, password, displayName });
        setWorkflowToken(payload.token);
        onAuthenticated(payload.user);
      }
      if (mode === "forgot") {
        const payload = await forgotWorkflowPassword(email);
        setMessage(payload.message);
      }
      if (mode === "reset") {
        const payload = await resetWorkflowPassword({ token: resetToken, newPassword: password });
        setMessage(payload.message);
        setMode("login");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    }
  }

  return (
    <main className="workflowAuth">
      <section className="workflowPoster">
        <span>Job Application Workflow Platform</span>
        <h1>Track every target role from saved to outcome.</h1>
        <p>
          A .NET-backed productivity SaaS for applications, CVs, cover letters,
          reminders, match summaries, and interview deadlines.
        </p>
      </section>
      <form className="workflowAuthPanel" onSubmit={submit}>
        <div>
          <span>{mode}</span>
          <h2>{mode === "register" ? "Create account" : mode === "login" ? "Welcome back" : "Password help"}</h2>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        {mode === "register" ? (
          <label>
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
        ) : null}
        {mode === "reset" ? (
          <label>
            Reset token
            <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} required />
          </label>
        ) : null}
        {mode !== "forgot" ? (
          <label>
            Password
            <input
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
        ) : null}
        <button type="submit">
          <Lock size={17} />
          {mode === "forgot" ? "Send reset email" : mode === "reset" ? "Reset password" : "Continue"}
        </button>
        {message ? <p className="workflowMessage">{message}</p> : null}
        {error ? <p className="workflowError">{error}</p> : null}
        <div className="authSwitches">
          <button type="button" onClick={() => setMode("login")}>Login</button>
          <button type="button" onClick={() => setMode("register")}>Register</button>
          <button type="button" onClick={() => setMode("forgot")}>Forgot</button>
          <button type="button" onClick={() => setMode("reset")}>Reset</button>
        </div>
      </form>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="workflowStat">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function DashboardView({
  applications,
  dashboard,
  selectedApplication,
  onNewApplication,
  onRefresh,
  onSelect,
  onStatus,
  onPriority,
  onDelete,
  onActionComplete
}: {
  applications: WorkflowApplication[];
  dashboard: WorkflowDashboard | null;
  selectedApplication: WorkflowApplication | null;
  onNewApplication: () => void;
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
  const openApplication = (application: WorkflowApplication) => {
    onSelect(application);
    setViewMode("detail");
  };

  if (viewMode === "detail") {
    return (
      <section className="workflowStack">
        <div className="panelTitle applicationToolbar">
          <button type="button" className="secondaryAction" onClick={() => setViewMode("tracker")}>
            <ArrowLeft size={16} />
            Back to tracker
          </button>
        </div>
        <DetailView application={selectedApplication} onActionComplete={onActionComplete} />
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
            <article className="workflowApplicationCard" key={application.id}>
              <button type="button" onClick={() => openApplication(application)}>
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
            <span>{item.companyName} · {formatDate(item.deadline)}</span>
          </div>
        )) : <p className="workflowMuted">No deadlines yet.</p>}
      </section>
    </section>
  );
}

function ApplicationsView({
  applications,
  cvs,
  onCreate,
  onRefresh,
  onSelect,
  onStatus,
  onPriority,
  onDelete,
  mode,
  onModeChange
}: {
  applications: WorkflowApplication[];
  cvs: Array<{ id: string; fileName: string; createdAt: string }>;
  onCreate: (input: typeof emptyApplication & { cvDocumentId?: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelect: (application: WorkflowApplication) => void;
  onStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  onPriority: (id: string, priority: ApplicationPriority) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  mode: "tracker" | "create";
  onModeChange: (mode: "tracker" | "create") => void;
}) {
  const [draft, setDraft] = useState(emptyApplication);
  const [cvDocumentId, setCvDocumentId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate({ ...draft, cvDocumentId: cvDocumentId || undefined });
    setDraft(emptyApplication);
    setCvDocumentId("");
    onModeChange("tracker");
  }

  async function importFromLink() {
    if (!draft.jobUrl.trim()) return;

    setIsImporting(true);
    setImportError("");
    try {
      const imported = await importWorkflowJob(draft.jobUrl);
      setDraft((current) => ({
        ...current,
        companyName: imported.companyName || current.companyName,
        roleTitle: imported.roleTitle || current.roleTitle,
        source: imported.source || current.source,
        jobUrl: imported.jobUrl || current.jobUrl,
        jobDescription: imported.description || current.jobDescription
      }));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import this job link");
    } finally {
      setIsImporting(false);
    }
  }

  if (mode === "create") {
    return (
      <section className="workflowPanel applicationCreatePage">
        <div className="panelTitle applicationToolbar">
          <div>
            <h2>Save application</h2>
            <p className="workflowMuted">Import a job link when possible, then add the application details you want to track.</p>
          </div>
        </div>
        <form className="workflowForm applicationCreateForm" onSubmit={submit}>
          <div className="applicationFormGrid">
            <div className="applicationMainFields">
              <label>Company<input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} required /></label>
              <label>Role<input value={draft.roleTitle} onChange={(event) => setDraft({ ...draft, roleTitle: event.target.value })} required /></label>
              <label>Original job link<input value={draft.jobUrl} onChange={(event) => setDraft({ ...draft, jobUrl: event.target.value })} /></label>
              <div className="inlineActions">
                <button type="button" onClick={importFromLink} disabled={!draft.jobUrl.trim() || isImporting}>
                  {isImporting ? "Importing..." : "Import from link"}
                </button>
                {importError ? <p className="workflowError">{importError}</p> : null}
              </div>
              <label>Job description<textarea value={draft.jobDescription} onChange={(event) => setDraft({ ...draft, jobDescription: event.target.value })} placeholder="Imported from the link, or paste JD text here..." /></label>
            </div>
            <aside className="applicationSideFields">
              <label>Source<input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label>
              <label>Deadline<input value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} type="datetime-local" /></label>
              <label>CV<select value={cvDocumentId} onChange={(event) => setCvDocumentId(event.target.value)}>
                <option value="">No CV selected</option>
                {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.fileName}</option>)}
              </select></label>
              <label>Priority<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as ApplicationPriority })}>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select></label>
              <label>Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Your private notes, recruiter context, or application plan..." /></label>
            </aside>
          </div>
          <div className="formFooter">
            <button type="button" className="secondaryAction" onClick={() => onModeChange("tracker")}>Back to dashboard</button>
            <button type="submit">Save application</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="applicationPage">
      <section className="workflowPanel">
        <div className="panelTitle">
          <RefreshCw size={18} />
          <h2>Application tracker</h2>
          <button type="button" onClick={() => onModeChange("create")}>
            <Plus size={16} />
            New application
          </button>
          <button type="button" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="workflowList">
          {applications.length ? applications.map((application) => (
            <article className="workflowApplicationCard" key={application.id}>
              <button type="button" onClick={() => onSelect(application)}>
                <strong>{application.companyName} - {application.roleTitle}</strong>
                <span>{application.source || "Manual"} · {formatDate(application.deadline)}</span>
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
          )) : (
            <div className="emptyTracker">
              <BriefcaseBusiness size={22} />
              <strong>No applications yet</strong>
              <p className="workflowMuted">Start by saving a role from a link or paste the JD manually.</p>
              <button type="button" onClick={() => onModeChange("create")}>Create first application</button>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function DetailView({
  application,
  onActionComplete
}: {
  application: WorkflowApplication | null;
  onActionComplete: () => Promise<void>;
}) {
  const [coverLetter, setCoverLetter] = useState("");
  const [note, setNote] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [match, setMatch] = useState<{ summary: string; missingSkills: string; score: number } | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCoverLetter("");
    setMatch(null);
    setIsMatching(false);
    setMessage("");
  }, [application?.id]);

  if (!application) {
    return <section className="workflowPanel"><p className="workflowMuted">Select an application to manage documents, notes, reminders, and match summary.</p></section>;
  }

  const currentSummary = match?.summary || application.matchSummary || "";
  const missingSkills = splitList(match?.missingSkills || application.missingSkills);
  const jdPreview = compactText(application.jobDescription, 760);

  async function saveCoverLetter() {
    await addWorkflowDocument(application!.id, {
      type: "CoverLetter",
      title: "Cover letter",
      content: coverLetter
    });
    setCoverLetter("");
    setMessage("Cover letter saved.");
    await onActionComplete();
  }

  async function saveNote() {
    await addWorkflowNote(application!.id, note);
    setNote("");
    setMessage("Note saved.");
    await onActionComplete();
  }

  async function saveReminder() {
    await addWorkflowReminder(application!.id, {
      kind: "FollowUp",
      dueAt: new Date(reminderAt).toISOString(),
      message: reminderMessage || `Follow up with ${application!.companyName}`
    });
    setReminderAt("");
    setReminderMessage("");
    setMessage("Reminder scheduled.");
    await onActionComplete();
  }

  async function generateMatch() {
    setIsMatching(true);
    setMessage("");
    try {
      const payload = await generateWorkflowMatchSummary(application!.id, application!.jobDescription || "");
      setMatch(payload);
      setMessage(`Match analysis updated: ${payload.score}% fit.`);
      await onActionComplete();
    } finally {
      setIsMatching(false);
    }
  }

  function generateCoverLetterDraft() {
    setCoverLetter(buildCoverLetterDraft(application!, currentSummary));
  }

  return (
    <section className="workflowPanel workflowDetail">
      <div className="detailHeader">
        <div>
          <span>{application.status} · {application.priority}</span>
          <h2>{application.roleTitle}</h2>
          <p>{application.companyName}</p>
        </div>
        {application.jobUrl ? <a href={application.jobUrl} target="_blank" rel="noreferrer">Original posting</a> : null}
      </div>
      {message ? <p className="workflowMessage">{message}</p> : null}
      <div className="workflowDetailGrid applicationInsightGrid">
        <section>
          <h3>JD brief</h3>
          {jdPreview ? <p>{jdPreview}</p> : <p className="workflowMuted">No job description was saved for this application yet.</p>}
          <small>{application.jobUrl ? "Imported from the original posting or saved JD text." : "Add a JD when creating the application for better analysis."}</small>
        </section>
        <section>
          <h3>CV match</h3>
          <button type="button" onClick={generateMatch} disabled={!application.jobDescription || isMatching}>
            {isMatching ? "Analyzing..." : currentSummary ? "Refresh match analysis" : "Run match analysis"}
          </button>
          {currentSummary ? <p>{currentSummary}</p> : <p className="workflowMuted">Run analysis to compare the saved JD with the selected CV.</p>}
          {match ? <strong className="fitScore">{match.score}% fit score</strong> : null}
        </section>
        <section>
          <h3>Missing skills</h3>
          {missingSkills.length ? (
            <ul className="insightList">
              {missingSkills.map((skill) => <li key={skill}>{skill}</li>)}
            </ul>
          ) : (
            <p className="workflowMuted">No missing skills have been generated yet.</p>
          )}
        </section>
        <section>
          <h3>Application material</h3>
          <button type="button" onClick={generateCoverLetterDraft}>Generate cover letter draft</button>
          <textarea value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Generated draft will appear here for review before saving." />
          <button type="button" onClick={saveCoverLetter} disabled={!coverLetter.trim()}>Save cover letter</button>
          <small>{application.documents.length} document(s) saved</small>
        </section>
        <section>
          <h3>Follow-up reminder</h3>
          <input value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} type="datetime-local" />
          <input value={reminderMessage} onChange={(event) => setReminderMessage(event.target.value)} placeholder="Follow-up / interview reminder" />
          <button type="button" onClick={saveReminder} disabled={!reminderAt}>Schedule reminder</button>
          <small>{application.reminders.length} reminder(s)</small>
        </section>
        <section>
          <h3>Private notes</h3>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Recruiter notes, interview feedback, follow-up context..." />
          <button type="button" onClick={saveNote} disabled={!note.trim()}>Add note</button>
          <p>{application.notes || "No pinned note yet."}</p>
        </section>
      </div>
    </section>
  );
}

function CvView({
  cvs,
  onCreated
}: {
  cvs: Array<{ id: string; fileName: string; createdAt: string }>;
  onCreated: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCv, setSelectedCv] = useState<{ id: string; fileName: string; url: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (selectedCv?.url) {
        URL.revokeObjectURL(selectedCv.url);
      }
    };
  }, [selectedCv?.url]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError("");
    try {
      await uploadWorkflowCv(file);
      setFile(null);
      setMessage("CV uploaded.");
      await onCreated();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload CV.");
    } finally {
      setIsUploading(false);
    }
  }

  async function viewCv(id: string) {
    setError("");
    try {
      const cv = cvs.find((item) => item.id === id);
      const blob = await fetchWorkflowCvPdf(id);
      if (selectedCv?.url) {
        URL.revokeObjectURL(selectedCv.url);
      }
      setSelectedCv({
        id,
        fileName: cv?.fileName || "CV.pdf",
        url: URL.createObjectURL(blob)
      });
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Could not load CV.");
    }
  }

  async function removeCv(id: string) {
    if (!window.confirm("Delete this CV from your library? Applications using it will keep their records but no longer point to this CV.")) {
      return;
    }

    setError("");
    try {
      await deleteWorkflowCv(id);
      if (selectedCv?.id === id) {
        setSelectedCv(null);
      }
      setMessage("CV deleted.");
      await onCreated();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete CV.");
    }
  }

  return (
    <section className="cvLibraryPage">
      <section className="workflowPanel">
        <div className="panelTitle"><FileText size={18} /><h2>Uploaded CVs</h2></div>
        <div className="cvList">
          {cvs.length ? cvs.map((cv) => (
            <article className="cvLibraryItem" key={cv.id}>
              <button type="button" onClick={() => viewCv(cv.id)}>
                <strong>{cv.fileName}</strong>
                <span>{formatDate(cv.createdAt)}</span>
              </button>
              <button type="button" className="secondaryAction" onClick={() => viewCv(cv.id)}>View</button>
              <button type="button" className="dangerAction" onClick={() => removeCv(cv.id)}>Delete</button>
            </article>
          )) : (
            <div className="emptyTracker">
              <FileText size={22} />
              <strong>No CVs uploaded yet</strong>
              <p className="workflowMuted">Upload a CV file or paste CV text to reuse it across applications.</p>
            </div>
          )}
        </div>
      </section>
      <section className="workflowPanel cvPreviewPanel">
        <div className="panelTitle"><FileText size={18} /><h2>CV preview</h2></div>
        {selectedCv ? (
          <>
            <strong>{selectedCv.fileName}</strong>
            <iframe className="cvPdfFrame" src={selectedCv.url} title={selectedCv.fileName} />
          </>
        ) : (
          <p className="workflowMuted">Select a CV to preview the original PDF.</p>
        )}
      </section>
      <form className="workflowPanel workflowForm cvUploadPanel" onSubmit={upload}>
        <div className="panelTitle"><FileText size={18} /><h2>Upload PDF CV</h2></div>
        <label>PDF file
          <input
            accept=".pdf,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        <button type="submit" disabled={!file || isUploading}>
          {isUploading ? "Uploading..." : "Upload PDF"}
        </button>
        <p className="workflowMuted">Only PDF CVs are supported. The platform extracts text for matching while keeping the original PDF for preview.</p>
      </form>
      {message ? <p className="workflowMessage">{message}</p> : null}
      {error ? <p className="workflowError">{error}</p> : null}
    </section>
  );
}

function AdminView({ user }: { user: WorkflowUser }) {
  const [users, setUsers] = useState<WorkflowUser[]>([]);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setUsers(await fetchAdminUsers());
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Admin request failed");
    }
  }

  return (
    <section className="workflowPanel">
      <div className="panelTitle"><Shield size={18} /><h2>Admin</h2><button type="button" onClick={loadUsers}>Load users</button></div>
      <p className="workflowMuted">Current role: {user.role}. Admin endpoint is role protected.</p>
      {error ? <p className="workflowError">{error}</p> : null}
      {users.map((item) => <div className="deadlineRow" key={item.id}><strong>{item.displayName}</strong><span>{item.email} · {item.role}</span></div>)}
    </section>
  );
}

export function App() {
  const [user, setUser] = useState<WorkflowUser | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [applications, setApplications] = useState<WorkflowApplication[]>([]);
  const [dashboard, setDashboard] = useState<WorkflowDashboard | null>(null);
  const [cvs, setCvs] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [applicationMode, setApplicationMode] = useState<"tracker" | "create">("create");
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

  async function createApplication(input: typeof emptyApplication & { cvDocumentId?: string }) {
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
    setApplicationMode("create");
    setPage("applications");
  }

  function changeApplicationMode(mode: "tracker" | "create") {
    setApplicationMode(mode);
    if (mode === "tracker") {
      setPage("dashboard");
      return;
    }

    setPage("applications");
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
            <h1>{page === "dashboard" ? "Application progress dashboard" : page === "applications" ? "Create job application" : page === "cvs" ? "CV library" : "Admin console"}</h1>
          </div>
          <button type="button" onClick={loadAll}><RefreshCw size={16} /> Refresh</button>
        </header>
        {error ? <p className="workflowError">{error}</p> : null}
        {page === "dashboard" ? (
          <DashboardView
            applications={applications}
            dashboard={dashboard}
            selectedApplication={selectedApplication}
            onActionComplete={loadAll}
            onNewApplication={openCreateApplication}
            onDelete={removeApplication}
            onPriority={changePriority}
            onRefresh={loadAll}
            onSelect={(application) => setSelectedId(application.id)}
            onStatus={changeStatus}
          />
        ) : null}
        {page === "applications" ? (
          <>
            <ApplicationsView
              applications={applications}
              cvs={cvs}
              onCreate={createApplication}
              onDelete={removeApplication}
              onPriority={changePriority}
              onRefresh={loadAll}
              onSelect={(application) => setSelectedId(application.id)}
              onStatus={changeStatus}
              mode={applicationMode}
              onModeChange={changeApplicationMode}
            />
          </>
        ) : null}
        {page === "cvs" ? <CvView cvs={cvs} onCreated={loadAll} /> : null}
        {page === "admin" ? <AdminView user={user} /> : null}
      </section>
    </main>
  );
}
