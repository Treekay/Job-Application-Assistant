import { FormEvent, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { deleteWorkflowCv, fetchWorkflowCvPdf, uploadWorkflowCv } from "../api/workflowApi";
import { formatDate } from "../utils/format";

export function CvView({
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
              <p className="workflowMuted">Upload a PDF CV to reuse it across applications.</p>
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
