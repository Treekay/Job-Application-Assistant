import React, { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldAlert
} from "lucide-react";
import {
  analyzeJobFeedItem,
  fetchInitialData,
  fetchJobFeed,
  scrapeJobFeed,
  updateJobFeedState
} from "../api.js";

const sourceOptions = [
  { id: "seek", label: "SEEK" },
  { id: "indeed", label: "Indeed" },
  { id: "linkedin", label: "LinkedIn" }
];

const statusFilters = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "open", label: "Open" },
  { id: "viewed", label: "Viewed" },
  { id: "applied", label: "Applied" },
  { id: "expired", label: "Expired" }
];

const keywordPresets = ["data", "software", "developer", "intern", "graduate", "backend"];

function formatDate(value) {
  if (!value) return "Not found";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not found";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function workRightsClass(status) {
  if (status === "restricted") return "risk";
  if (status === "open_work_rights") return "ok";
  return "neutral";
}

function jobSubtitle(job) {
  return [job.company || "Unknown company", job.location || "Location not found"].join(" - ");
}

export function JobFeedPage({ onOpenRun }) {
  const [cvs, setCvs] = useState([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [keywords, setKeywords] = useState("data software developer intern");
  const [location, setLocation] = useState("Auckland");
  const [selectedSources, setSelectedSources] = useState(["seek", "indeed"]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [analyzingJobId, setAnalyzingJobId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCvName = useMemo(
    () => cvs.find((cv) => cv._id === selectedCvId)?.fileName || "",
    [cvs, selectedCvId]
  );

  async function loadJobs(nextCvId = selectedCvId, nextStatus = statusFilter, nextSource = sourceFilter) {
    if (!nextCvId) return;

    setIsLoading(true);
    setError("");

    try {
      const payload = await fetchJobFeed({
        cvId: nextCvId,
        status: nextStatus,
        source: nextSource
      });
      setJobs(payload.jobs || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitial() {
      setIsLoading(true);
      setError("");

      try {
        const [cvPayload] = await fetchInitialData();
        const nextCvs = cvPayload.cvs || [];
        const firstCvId = nextCvs[0]?._id || "";
        setCvs(nextCvs);
        setSelectedCvId(firstCvId);
        if (firstCvId) {
          const jobPayload = await fetchJobFeed({ cvId: firstCvId });
          setJobs(jobPayload.jobs || []);
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadInitial();
  }, []);

  async function refreshFeed(event) {
    event.preventDefault();
    if (!selectedCvId) return;

    setIsScraping(true);
    setError("");
    setMessage("Refreshing job feed");

    try {
      const payload = await scrapeJobFeed({
        cvId: selectedCvId,
        keywords,
        location,
        sources: selectedSources,
        urls: []
      });
      setJobs(payload.jobs || []);
      const blocked = payload.errors?.length ? ` ${payload.errors.length} source requests failed.` : "";
      setMessage(
        `Imported ${payload.imported || 0} jobs from ${payload.discovered || 0} discovered links.${blocked}`
      );
    } catch (scrapeError) {
      setError(scrapeError.message);
      setMessage("");
    } finally {
      setIsScraping(false);
    }
  }

  async function toggleJobState(job, updates) {
    setError("");

    try {
      const payload = await updateJobFeedState(job._id, updates);
      setJobs((current) => current.map((item) => (item._id === job._id ? payload.job : item)));
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function analyzeJob(job) {
    if (!selectedCvId) return;

    setAnalyzingJobId(job._id);
    setError("");
    setMessage(`Running AI analysis for ${job.title}`);

    try {
      const payload = await analyzeJobFeedItem(job._id, { cvId: selectedCvId });
      setMessage("Application analysis created.");
      if (payload.id && onOpenRun) {
        onOpenRun(payload.id);
      }
    } catch (analyzeError) {
      setError(analyzeError.message);
      setMessage("");
    } finally {
      setAnalyzingJobId("");
    }
  }

  function toggleSource(sourceId) {
    setSelectedSources((current) =>
      current.includes(sourceId)
        ? current.filter((item) => item !== sourceId)
        : [...current, sourceId]
    );
  }

  function useKeywordPreset(keyword) {
    setKeywords((current) => {
      const words = current.toLowerCase().split(/\s|,|;/).filter(Boolean);
      return words.includes(keyword) ? current : `${current} ${keyword}`.trim();
    });
  }

  return (
    <main className="pageShell">
      <section className="pageHeader compactHeader">
        <div>
          <span>Job Feed</span>
          <h1>Track fresh roles before spending AI tokens.</h1>
        </div>
        <p>
          Choose a platform, search by role keywords, dedupe roles, rank them against a CV,
          then start an AI application analysis directly from a saved job.
        </p>
      </section>

      <section className="jobFeedLayout">
        <form className="jobFeedControls" onSubmit={refreshFeed}>
          <div className="panelTitle">
            <Search size={18} />
            <h2>Search jobs</h2>
          </div>

          <label className="runSelector">
            <span>CV for matching</span>
            <select
              value={selectedCvId}
              onChange={(event) => {
                setSelectedCvId(event.target.value);
                loadJobs(event.target.value);
              }}
            >
              {cvs.map((cv) => (
                <option key={cv._id} value={cv._id}>
                  {cv.fileName}
                </option>
              ))}
            </select>
          </label>

          <label className="runSelector">
            <span>Keywords</span>
            <textarea
              className="detailTextarea compactTextarea"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
          </label>

          <div className="jobKeywordPresets" aria-label="Keyword presets">
            {keywordPresets.map((keyword) => (
              <button key={keyword} type="button" onClick={() => useKeywordPreset(keyword)}>
                {keyword}
              </button>
            ))}
          </div>

          <label className="runSelector">
            <span>Location</span>
            <input
              className="detailInput"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>

          <div className="jobSourceGrid">
            {sourceOptions.map((source) => (
              <label key={source.id}>
                <input
                  checked={selectedSources.includes(source.id)}
                  type="checkbox"
                  onChange={() => toggleSource(source.id)}
                />
                {source.label}
              </label>
            ))}
          </div>

          <button className="runButton" disabled={!selectedCvId || isScraping} type="submit">
            <RefreshCw size={17} />
            {isScraping ? "Searching..." : "Search Selected Platforms"}
          </button>

          {message ? <p className="jobFeedMessage">{message}</p> : null}
          {error ? <p className="jobFeedError">{error}</p> : null}
        </form>

        <section className="jobFeedResults">
          <div className="jobFeedToolbar">
            <div>
              <strong>{jobs.length} roles</strong>
              <span>{selectedCvName || "Select a CV"}</span>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                loadJobs(selectedCvId, event.target.value, sourceFilter);
              }}
            >
              {statusFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                loadJobs(selectedCvId, statusFilter, event.target.value);
              }}
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? <div className="emptyState">Loading job feed...</div> : null}

          <div className="jobCardList">
            {jobs.map((job) => (
              <article className="jobCard" key={job._id}>
                <div className="jobCardHeader">
                  <div>
                    <span>{job.sourceLabel || job.source}</span>
                    <h2>{job.title}</h2>
                    <p>{jobSubtitle(job)}</p>
                  </div>
                  <strong>{job.matchScore || 0}%</strong>
                </div>

                <div className="jobMetaGrid">
                  <span className={`workRightsBadge ${workRightsClass(job.workRights?.status)}`}>
                    <ShieldAlert size={14} />
                    {job.workRights?.label || "Not found"}
                  </span>
                  <span>{job.isOpen ? "Open" : "Expired"}</span>
                  <span>Posted {formatDate(job.postedAt)}</span>
                  <span>Closes {formatDate(job.closingDate)}</span>
                </div>

                <div className="keywordList jobKeywords">
                  {(job.matchedKeywords || []).slice(0, 8).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                  {!job.matchedKeywords?.length ? <em>No keyword hits yet</em> : null}
                </div>

                <div className="jobCardActions">
                  <a href={job.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => toggleJobState(job, { viewed: !job.viewed })}
                  >
                    <Eye size={15} />
                    {job.viewed ? "Viewed" : "Mark viewed"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleJobState(job, { applied: !job.applied, viewed: true })}
                  >
                    <CheckCircle2 size={15} />
                    {job.applied ? "Applied" : "Mark applied"}
                  </button>
                  <button
                    disabled={analyzingJobId === job._id}
                    type="button"
                    onClick={() => analyzeJob(job)}
                  >
                    {analyzingJobId === job._id ? (
                      <Loader2 className="spin" size={15} />
                    ) : (
                      <Send size={15} />
                    )}
                    {analyzingJobId === job._id ? "Analyzing" : "Analyze"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!isLoading && !jobs.length ? (
            <div className="emptyState">
              <BriefcaseBusiness size={22} />
              <h2>No jobs saved yet</h2>
              <p>Select platforms and enter role keywords to start building a daily list.</p>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
