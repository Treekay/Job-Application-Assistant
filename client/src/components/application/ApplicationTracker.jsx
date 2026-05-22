import React from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { applicationPriorities, applicationStatuses } from "../../data.js";
import {
  formatRunDate,
  getRunStatus,
  getRunStatusLabel,
  getRunTitle
} from "../../resultUtils.js";

function statusIndex(run) {
  return Math.max(
    0,
    applicationStatuses.findIndex((status) => status.id === getRunStatus(run))
  );
}

function progressStepClass(index, currentIndex) {
  return [
    index <= currentIndex ? "complete" : "",
    index === currentIndex ? "current" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function progressRatio(run) {
  const maxIndex = Math.max(1, applicationStatuses.length - 1);
  return statusIndex(run) / maxIndex;
}

export function ApplicationTracker({
  activeStatus,
  onDeleteRun,
  onPriorityChange,
  onSelectRun,
  runs
}) {
  const visibleRuns =
    activeStatus === "all" ? runs : runs.filter((run) => getRunStatus(run) === activeStatus);

  return (
    <section className="historyBlock">
      <div className="historyHeader">
        <div>
          <span>Application Tracker</span>
        </div>
      </div>
      {visibleRuns.length ? (
        <div className="recordList">
          {visibleRuns.map((run) => (
            <div className="recordItem trackerItem" key={run._id}>
              <button type="button" onClick={() => onSelectRun(run)}>
                <div className="applicationRowTop">
                  <span>{getRunTitle(run)}</span>
                  <strong>{run.result?.fitScore ?? run.result?.matchScore ?? "--"}%</strong>
                </div>
                <small>
                  {run.createdAt ? formatRunDate(run.createdAt) : "No date"} -{" "}
                  {getRunStatusLabel(run)}
                  {run.trackingSource ? ` - ${run.trackingSource.replace("_", " ")}` : ""}
                </small>
                <div className="applicationProgress" style={{ "--progress": progressRatio(run) }}>
                  <div className="applicationProgressTrack" aria-hidden="true">
                    <span />
                  </div>
                  {applicationStatuses.map((status, index) => {
                    const currentIndex = statusIndex(run);

                    return (
                      <span className={progressStepClass(index, currentIndex)} key={status.id}>
                        <i />
                        <em>{status.label}</em>
                      </span>
                    );
                  })}
                </div>
              </button>
              <div className="trackerActions">
                <select
                  aria-label={`Priority for ${getRunTitle(run)}`}
                  value={run.priority || "medium"}
                  onChange={(event) => onPriorityChange(run._id, event.target.value)}
                >
                  {applicationPriorities.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                {run.jobUrl ? (
                  <a
                    className="iconButton neutral"
                    href={run.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open source job for ${getRunTitle(run)}`}
                  >
                    <ExternalLink size={16} />
                  </a>
                ) : null}
                <button
                  className="iconButton"
                  type="button"
                  aria-label={`Delete ${getRunTitle(run)}`}
                  onClick={() => onDeleteRun(run._id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No applications in this status yet.</p>
      )}
    </section>
  );
}
