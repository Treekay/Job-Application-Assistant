import { FormEvent, useState } from "react";
import { priorities, type ApplicationDraft, emptyApplication } from "../constants/workflow";
import { importWorkflowJob } from "../api/workflowApi";
import type { ApplicationPriority } from "../types/workflow";

export function ApplicationsView({
  cvs,
  onCreate,
  onModeChange
}: {
  cvs: Array<{ id: string; fileName: string; createdAt: string }>;
  onCreate: (input: ApplicationDraft) => Promise<void>;
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
