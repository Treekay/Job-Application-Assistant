import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  addWorkflowDocument,
  addWorkflowNote,
  addWorkflowReminder,
  generateWorkflowCoverLetter,
  generateWorkflowEmail,
  generateWorkflowMatchSummary,
  updateWorkflowApplication
} from "../api/workflowApi";
import { MarkdownBlock } from "../components/MarkdownBlock";
import { priorities } from "../constants/workflow";
import type { ApplicationPriority, WorkflowApplication, WorkflowMatchAnalysis, WorkflowRequirementAnalysis } from "../types/workflow";
import { buildCoverLetterDraft } from "../utils/coverLetter";
import { compactText, daysSince, splitList } from "../utils/format";

type MatchResult = WorkflowMatchAnalysis;
type ApplicationDetailDraft = {
  companyName: string;
  roleTitle: string;
  jobUrl: string;
  jobDescription: string;
  source: string;
  priority: ApplicationPriority;
  deadline: string;
  cvDocumentId: string;
  notes: string;
};

export function ApplicationDetailView({
  application,
  cvs,
  onActionComplete
}: {
  application: WorkflowApplication | null;
  cvs: Array<{ id: string; fileName: string; createdAt: string }>;
  onActionComplete: () => Promise<void>;
}) {
  const [coverLetter, setCoverLetter] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState({
    companyName: "",
    roleTitle: "",
    jobUrl: "",
    jobDescription: "",
    source: "",
    priority: "Medium" as ApplicationPriority,
    deadline: "",
    cvDocumentId: "",
    notes: ""
  });
  const [note, setNote] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCoverLetter("");
    setEmailDraft("");
    setDetailDraft({
      companyName: application?.companyName || "",
      roleTitle: application?.roleTitle || "",
      jobUrl: application?.jobUrl || "",
      jobDescription: application?.jobDescription || "",
      source: application?.source || "Manual",
      priority: application?.priority || "Medium",
      deadline: application?.deadline ? application.deadline.slice(0, 16) : "",
      cvDocumentId: application?.cvDocumentId || "",
      notes: application?.notes || ""
    });
    setMatch(null);
    setIsMatching(false);
    setIsGeneratingMaterial(false);
    setMessage("");
  }, [application]);

  if (!application) {
    return (
      <section className="workflowPanel">
        <p className="workflowMuted">Select an application to review its current workflow stage.</p>
      </section>
    );
  }

  const currentSummary = match?.summary || application.matchSummary || "";
  const currentAnalysis = match || application.matchAnalysis || null;
  const missingSkills = splitList(currentAnalysis?.missingSkills || application.missingSkills);
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

  async function saveEmail() {
    await addWorkflowDocument(application!.id, {
      type: "Email",
      title: "Outreach email",
      content: emailDraft
    });
    setEmailDraft("");
    setMessage("Email draft saved.");
    await onActionComplete();
  }

  async function saveApplicationDetails(event: FormEvent) {
    event.preventDefault();
    await updateWorkflowApplication(application!.id, {
      ...detailDraft,
      cvDocumentId: detailDraft.cvDocumentId || undefined,
      deadline: detailDraft.deadline ? new Date(detailDraft.deadline).toISOString() : undefined
    });
    setMessage("Application details saved.");
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
      kind: application!.status === "Interview" ? "Interview" : "FollowUp",
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

  async function generateAiCoverLetter() {
    setIsGeneratingMaterial(true);
    setMessage("");
    try {
      const payload = await generateWorkflowCoverLetter(application!.id);
      setCoverLetter(payload.content);
      setMessage("AI cover letter draft generated.");
    } finally {
      setIsGeneratingMaterial(false);
    }
  }

  async function generateAiEmail() {
    setIsGeneratingMaterial(true);
    setMessage("");
    try {
      const payload = await generateWorkflowEmail(application!.id);
      setEmailDraft(payload.content);
      setMessage("AI email draft generated.");
    } finally {
      setIsGeneratingMaterial(false);
    }
  }

  return (
    <section className="workflowPanel workflowDetail">
      <div className="detailHeader">
        <div>
          <span>{application.status} - {application.priority}</span>
          <h2>{application.roleTitle}</h2>
          <p>{application.companyName}</p>
        </div>
        {application.jobUrl ? <a href={application.jobUrl} target="_blank" rel="noreferrer">Original posting</a> : null}
      </div>
      {message ? <p className="workflowMessage">{message}</p> : null}
      <ApplicationDetailsForm
        cvs={cvs}
        draft={detailDraft}
        onChange={setDetailDraft}
        onSubmit={saveApplicationDetails}
      />
      <StageBody
        application={application}
        coverLetter={coverLetter}
        emailDraft={emailDraft}
        currentSummary={currentSummary}
        currentAnalysis={currentAnalysis}
        isMatching={isMatching}
        isGeneratingMaterial={isGeneratingMaterial}
        jdPreview={jdPreview}
        match={match}
        missingSkills={missingSkills}
        note={note}
        reminderAt={reminderAt}
        reminderMessage={reminderMessage}
        onCoverLetterChange={setCoverLetter}
        onEmailDraftChange={setEmailDraft}
        onGenerateAiCoverLetter={generateAiCoverLetter}
        onGenerateAiEmail={generateAiEmail}
        onGenerateCoverLetter={generateCoverLetterDraft}
        onGenerateMatch={generateMatch}
        onNoteChange={setNote}
        onReminderAtChange={setReminderAt}
        onReminderMessageChange={setReminderMessage}
        onSaveCoverLetter={saveCoverLetter}
        onSaveEmail={saveEmail}
        onSaveNote={saveNote}
        onSaveReminder={saveReminder}
      />
    </section>
  );
}

function ApplicationDetailsForm({
  cvs,
  draft,
  onChange,
  onSubmit
}: {
  cvs: Array<{ id: string; fileName: string; createdAt: string }>;
  draft: ApplicationDetailDraft;
  onChange: (draft: ApplicationDetailDraft) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  return (
    <form className="workflowDetailForm" onSubmit={onSubmit}>
      <div className="panelTitle">
        <h3>Application details</h3>
      </div>
      <div className="applicationEditGrid">
        <label>Company<input value={draft.companyName} onChange={(event) => onChange({ ...draft, companyName: event.target.value })} required /></label>
        <label>Role<input value={draft.roleTitle} onChange={(event) => onChange({ ...draft, roleTitle: event.target.value })} required /></label>
        <label>Source<input value={draft.source} onChange={(event) => onChange({ ...draft, source: event.target.value })} /></label>
        <label>Priority<select value={draft.priority} onChange={(event) => onChange({ ...draft, priority: event.target.value as ApplicationPriority })}>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select></label>
        <label>Deadline<input value={draft.deadline} onChange={(event) => onChange({ ...draft, deadline: event.target.value })} type="datetime-local" /></label>
        <label>CV<select value={draft.cvDocumentId} onChange={(event) => onChange({ ...draft, cvDocumentId: event.target.value })}>
          <option value="">No CV selected</option>
          {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.fileName}</option>)}
        </select></label>
        <label className="wideField">Original job link<input value={draft.jobUrl} onChange={(event) => onChange({ ...draft, jobUrl: event.target.value })} /></label>
        <label className="wideField">Job description<textarea value={draft.jobDescription} onChange={(event) => onChange({ ...draft, jobDescription: event.target.value })} /></label>
        <label className="wideField">Pinned notes<textarea value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label>
      </div>
      <div className="formFooter">
        <button type="submit">Save application details</button>
      </div>
    </form>
  );
}

function StageBody(props: {
  application: WorkflowApplication;
  coverLetter: string;
  emailDraft: string;
  currentSummary: string;
  currentAnalysis: WorkflowMatchAnalysis | null;
  isMatching: boolean;
  isGeneratingMaterial: boolean;
  jdPreview: string;
  match: MatchResult | null;
  missingSkills: string[];
  note: string;
  reminderAt: string;
  reminderMessage: string;
  onCoverLetterChange: (value: string) => void;
  onEmailDraftChange: (value: string) => void;
  onGenerateAiCoverLetter: () => Promise<void>;
  onGenerateAiEmail: () => Promise<void>;
  onGenerateCoverLetter: () => void;
  onGenerateMatch: () => Promise<void>;
  onNoteChange: (value: string) => void;
  onReminderAtChange: (value: string) => void;
  onReminderMessageChange: (value: string) => void;
  onSaveCoverLetter: () => Promise<void>;
  onSaveEmail: () => Promise<void>;
  onSaveNote: () => Promise<void>;
  onSaveReminder: () => Promise<void>;
}) {
  if (props.application.status === "Saved") return <SavedStage {...props} />;
  if (props.application.status === "Applied") return <AppliedStage {...props} />;
  if (props.application.status === "Interview") return <InterviewStage {...props} />;
  return <OutcomeStage {...props} />;
}

function SavedStage(props: StageProps) {
  return (
    <div className="workflowDetailGrid applicationInsightGrid">
      <JdBrief {...props} />
      <CvMatch {...props} />
      <RequirementList title="Matched requirements" items={props.currentAnalysis?.matchedRequirements || []} emptyText="Run analysis to generate matched requirements." />
      <RequirementList title="Missing requirements" items={props.currentAnalysis?.missingRequirements || []} emptyText="Run analysis to generate missing requirements." />
      <EvidencePanel {...props} />
      <RecommendationPanel {...props} />
      <ApplicationMaterial {...props} />
      <FinalReport {...props} />
    </div>
  );
}

function AppliedStage(props: StageProps) {
  return (
    <div className="workflowDetailGrid applicationInsightGrid">
      <StagePanel title="Application follow-up">
        <p>{props.application.companyName} has been in Applied for {daysSince(props.application.updatedAt || props.application.createdAt)} day(s).</p>
        <p className="workflowMuted">Use this stage for follow-up timing, recruiter context, and interview readiness.</p>
      </StagePanel>
      <ReminderPanel {...props} title="Follow-up reminder" />
      <StagePanel title="Interview preparation">
        <ul className="insightList">
          <li>Prepare examples for the strongest overlaps in your match summary.</li>
          <li>Turn missing skills into honest learning or project notes.</li>
          <li>Keep a short story for why this company and role fit your next step.</li>
        </ul>
      </StagePanel>
      <CvMatch {...props} />
      <RecommendationPanel {...props} />
      <PrivateNotes {...props} />
    </div>
  );
}

function InterviewStage(props: StageProps) {
  return (
    <div className="workflowDetailGrid applicationInsightGrid">
      <StagePanel title="Interview workspace">
        <p>Record the interview format, interviewer names, questions, and your follow-up tasks here.</p>
        <p className="workflowMuted">After the interview, add notes while the details are still fresh.</p>
      </StagePanel>
      <ReminderPanel {...props} title="Interview reminder" />
      <StagePanel title="Feedback checklist">
        <ul className="insightList">
          <li>Were the questions mostly technical, behavioural, or product-focused?</li>
          <li>Which answers felt strong enough to reuse?</li>
          <li>Which skill or project evidence needs sharpening before the next round?</li>
        </ul>
      </StagePanel>
      <PrivateNotes {...props} />
    </div>
  );
}

function OutcomeStage(props: StageProps) {
  const isOffer = props.application.status === "Offer";
  return (
    <div className="workflowDetailGrid applicationInsightGrid">
      <StagePanel title={isOffer ? "Offer review" : "Application retrospective"}>
        <p>
          {isOffer
            ? "Summarise compensation, start date, visa or work-rights constraints, and any negotiation points."
            : "Summarise what likely blocked progress and decide whether the next improvement is CV evidence, skills, interview performance, or targeting."}
        </p>
      </StagePanel>
      <CvMatch {...props} />
      <RequirementList title="Missing requirements" items={props.currentAnalysis?.missingRequirements || []} emptyText="Run analysis to generate missing requirements." />
      <RecommendationPanel {...props} />
      <PrivateNotes {...props} />
    </div>
  );
}

type StageProps = Parameters<typeof StageBody>[0];

function StagePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function JdBrief(props: StageProps) {
  return (
    <StagePanel title="JD brief">
      {props.jdPreview ? <p>{props.jdPreview}</p> : <p className="workflowMuted">No job description was saved for this application yet.</p>}
      <small>{props.application.jobUrl ? "Imported from the original posting or saved JD text." : "Add a JD when creating the application for better analysis."}</small>
    </StagePanel>
  );
}

function CvMatch(props: StageProps) {
  return (
    <StagePanel title="CV match">
      <button type="button" onClick={props.onGenerateMatch} disabled={!props.application.jobDescription || props.isMatching}>
        {props.isMatching ? "Analyzing..." : props.currentSummary ? "Refresh match analysis" : "Run match analysis"}
      </button>
      {props.currentSummary ? <p>{props.currentSummary}</p> : <p className="workflowMuted">Run analysis to compare the saved JD with the selected CV.</p>}
      {props.currentAnalysis ? <strong className="fitScore">{props.currentAnalysis.score}% fit score</strong> : null}
    </StagePanel>
  );
}

function RequirementList({ title, items, emptyText }: { title: string; items: WorkflowRequirementAnalysis[]; emptyText: string }) {
  return (
    <StagePanel title={title}>
      {items.length ? (
        <div className="requirementList">
          {items.map((item) => (
            <article className="requirementItem" key={`${title}-${item.requirement}`}>
              <div>
                <strong>{item.requirement}</strong>
                <span className={`priorityText priority${item.priority}`}>{item.priority} Priority</span>
              </div>
              {item.evidence ? <p>{item.evidence}</p> : null}
              {item.notes ? <small>{item.notes}</small> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="workflowMuted">{emptyText}</p>
      )}
    </StagePanel>
  );
}

function EvidencePanel(props: StageProps) {
  return (
    <StagePanel title="Evidence">
      {props.currentAnalysis?.evidence?.length ? (
        <ul className="insightList">
          {props.currentAnalysis.evidence.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="workflowMuted">Run analysis to extract CV evidence against this JD.</p>
      )}
    </StagePanel>
  );
}

function RecommendationPanel(props: StageProps) {
  return (
    <StagePanel title="Recommendations">
      {props.currentAnalysis?.recommendations?.length ? (
        <ul className="insightList">
          {props.currentAnalysis.recommendations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="workflowMuted">Run analysis to generate next-step recommendations.</p>
      )}
    </StagePanel>
  );
}

function FinalReport(props: StageProps) {
  return (
    <StagePanel title="Final report">
      {props.currentAnalysis?.finalReport ? (
        <MarkdownBlock value={props.currentAnalysis.finalReport} />
      ) : (
        <p className="workflowMuted">Run analysis to generate a final report.</p>
      )}
    </StagePanel>
  );
}

function ApplicationMaterial(props: StageProps) {
  return (
    <StagePanel title="Application material">
      <div className="buttonRow">
        <button type="button" onClick={props.onGenerateAiCoverLetter} disabled={props.isGeneratingMaterial}>
          {props.isGeneratingMaterial ? "Generating..." : "AI cover letter"}
        </button>
        <button type="button" className="secondaryAction" onClick={props.onGenerateCoverLetter}>Template draft</button>
      </div>
      <textarea value={props.coverLetter} onChange={(event) => props.onCoverLetterChange(event.target.value)} placeholder="Generated draft will appear here for review before saving." />
      <button type="button" onClick={props.onSaveCoverLetter} disabled={!props.coverLetter.trim()}>Save cover letter</button>
      <button type="button" onClick={props.onGenerateAiEmail} disabled={props.isGeneratingMaterial}>
        {props.isGeneratingMaterial ? "Generating..." : "AI outreach email"}
      </button>
      <textarea value={props.emailDraft} onChange={(event) => props.onEmailDraftChange(event.target.value)} placeholder="Generated recruiter or application email will appear here." />
      <button type="button" onClick={props.onSaveEmail} disabled={!props.emailDraft.trim()}>Save email</button>
      <small>{props.application.documents.length} document(s) saved</small>
    </StagePanel>
  );
}

function ReminderPanel(props: StageProps & { title: string }) {
  return (
    <StagePanel title={props.title}>
      <input value={props.reminderAt} onChange={(event) => props.onReminderAtChange(event.target.value)} type="datetime-local" />
      <input value={props.reminderMessage} onChange={(event) => props.onReminderMessageChange(event.target.value)} placeholder="Follow-up / interview reminder" />
      <button type="button" onClick={props.onSaveReminder} disabled={!props.reminderAt}>Schedule reminder</button>
      <small>{props.application.reminders.length} reminder(s)</small>
    </StagePanel>
  );
}

function PrivateNotes(props: StageProps) {
  return (
    <StagePanel title="Private notes">
      <textarea value={props.note} onChange={(event) => props.onNoteChange(event.target.value)} placeholder="Recruiter notes, interview feedback, follow-up context..." />
      <button type="button" onClick={props.onSaveNote} disabled={!props.note.trim()}>Add note</button>
      <p>{props.application.notes || "No pinned note yet."}</p>
    </StagePanel>
  );
}
