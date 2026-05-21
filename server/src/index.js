import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractCvText } from "./extractText.js";
import { runApplicationAgent, runCoachAgent } from "./agent.js";
import {
  extractCvKeywords,
  scoreJobAgainstCv,
  scrapeJobSearch,
  scrapeJobUrls
} from "./jobFeed.js";
import {
  createSession,
  createUser,
  deleteCv,
  deleteRun,
  deleteSession,
  findUserByCredentials,
  getCv,
  getJob,
  getRun,
  getSessionUser,
  listJobs,
  listCvs,
  listRuns,
  saveCv,
  saveRun,
  saveRunCoachInsights,
  updateJobState,
  updateRunAnalysis,
  updateRunStageData,
  updateRunStatus,
  upsertScrapedJobs
} from "./database.js";

dotenv.config();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(currentDir, "../uploads");
const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...(process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  ]
);
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.has(origin);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadJobDescription({ jobDescription = "", jobUrl = "" }) {
  const pastedDescription = jobDescription.trim();
  const url = jobUrl.trim();

  if (pastedDescription) {
    return pastedDescription;
  }

  if (!url) {
    return "";
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ApplyAgent/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not load job URL (${response.status}).`);
  }

  const content = await response.text();
  const type = response.headers.get("content-type") || "";
  return type.includes("html") ? stripHtml(content) : content.trim();
}

function asyncRoute(handler) {
  return async (request, response) => {
    try {
      await handler(request, response);
    } catch (error) {
      console.error(error);
      response.status(500).json({
        message: error.message || "Request failed.",
        detail: process.env.NODE_ENV === "production" ? undefined : error.message,
        agentTrace: error.agentTrace
      });
    }
  };
}

function validateCredentials({ username = "", password = "" }) {
  const normalizedUsername = username.trim().toLowerCase();

  if (normalizedUsername.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  return { username: normalizedUsername, password };
}

function normalizeStringList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return fallback;
}

function sanitizeSearchText(value = "") {
  return String(value).trim().replace(/\s+/g, " ").slice(0, 180);
}

function getBearerToken(request) {
  const header = request.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function requireAuth(request, response, next) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getSessionUser(token) : null;

    if (!user) {
      response.status(401).json({ message: "Login required." });
      return;
    }

    request.auth = { token, user };
    next();
  } catch (error) {
    next(error);
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post(
  "/api/auth/register",
  asyncRoute(async (request, response) => {
    let credentials;

    try {
      credentials = validateCredentials(request.body);
    } catch (error) {
      response.status(400).json({ message: error.message });
      return;
    }

    try {
      const user = await createUser(credentials);
      const token = await createSession(user._id);
      response.status(201).json({ token, user });
    } catch (error) {
      if (error.code === 11000) {
        response.status(409).json({ message: "Username is already taken." });
        return;
      }

      throw error;
    }
  })
);

app.post(
  "/api/auth/login",
  asyncRoute(async (request, response) => {
    let credentials;

    try {
      credentials = validateCredentials(request.body);
    } catch (error) {
      response.status(400).json({ message: error.message });
      return;
    }

    const user = await findUserByCredentials(credentials);

    if (!user) {
      response.status(401).json({ message: "Invalid username or password." });
      return;
    }

    const token = await createSession(user._id);
    response.json({ token, user });
  })
);

app.get(
  "/api/auth/me",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.json({ user: request.auth.user });
  })
);

app.post(
  "/api/auth/logout",
  requireAuth,
  asyncRoute(async (request, response) => {
    await deleteSession(request.auth.token);
    response.json({ ok: true });
  })
);

app.use("/api/cvs", requireAuth);
app.use("/api/applications", requireAuth);
app.use("/api/jobs", requireAuth);

app.get(
  "/api/cvs",
  asyncRoute(async (_request, response) => {
    response.json({ cvs: await listCvs(_request.auth.user._id) });
  })
);

app.post(
  "/api/cvs",
  upload.single("cv"),
  asyncRoute(async (request, response) => {
    if (!request.file) {
      response.status(400).json({ message: "Upload a CV file first." });
      return;
    }

    const text = await extractCvText(request.file);
    const cvId = await saveCv(request.auth.user._id, {
      fileName: request.file.originalname,
      mimeType: request.file.mimetype,
      size: request.file.size,
      text
    });

    response.status(201).json({
      cv: {
        _id: cvId.toString(),
        fileName: request.file.originalname,
        mimeType: request.file.mimetype,
        size: request.file.size,
        createdAt: new Date().toISOString()
      }
    });
  })
);

app.delete(
  "/api/cvs/:id",
  asyncRoute(async (request, response) => {
    const deleted = await deleteCv(request.auth.user._id, request.params.id);
    response.json({ deleted });
  })
);

app.get(
  "/api/jobs",
  asyncRoute(async (request, response) => {
    const jobs = await listJobs(request.auth.user._id, {
      cvId: request.query.cvId || "",
      status: request.query.status || "all",
      source: request.query.source || "all",
      limit: request.query.limit || 80
    });
    response.json({ jobs });
  })
);

app.post(
  "/api/jobs/scrape",
  asyncRoute(async (request, response) => {
    const {
      cvId,
      keywords = "",
      location = "Auckland",
      sources = ["seek", "indeed"],
      urls = []
    } = request.body || {};

    if (!cvId) {
      response.status(400).json({ message: "Select a CV before refreshing the job feed." });
      return;
    }

    const cv = await getCv(request.auth.user._id, cvId);
    if (!cv) {
      response.status(404).json({ message: "Selected CV was not found." });
      return;
    }

    const fallbackKeywords = extractCvKeywords(cv.text, 10).slice(0, 8).join(" ");
    const searchKeywords = sanitizeSearchText(keywords || fallbackKeywords);
    const selectedSources = normalizeStringList(sources, ["seek", "indeed"]);
    const directUrls = normalizeStringList(urls);
    const preferredKeywords = extractCvKeywords(`${keywords} ${cv.text}`, 32);

    const [searchResult, urlResult] = await Promise.all([
      searchKeywords
        ? scrapeJobSearch({
            sources: selectedSources,
            keywords: searchKeywords,
            location: sanitizeSearchText(location) || "Auckland"
          })
        : { jobs: [], errors: [], discoveredCount: 0 },
      directUrls.length ? scrapeJobUrls(directUrls) : { jobs: [], errors: [] }
    ]);

    const scoredJobs = [...searchResult.jobs, ...urlResult.jobs].map((job) => ({
      ...job,
      ...scoreJobAgainstCv(job, cv.text, preferredKeywords)
    }));
    const savedJobs = await upsertScrapedJobs(request.auth.user._id, cvId, scoredJobs);
    const jobs = await listJobs(request.auth.user._id, { cvId, limit: 80 });

    response.json({
      jobs,
      imported: savedJobs.length,
      discovered: searchResult.discoveredCount || 0,
      errors: [...(searchResult.errors || []), ...(urlResult.errors || [])]
    });
  })
);

app.patch(
  "/api/jobs/:id/state",
  asyncRoute(async (request, response) => {
    const job = await updateJobState(request.auth.user._id, request.params.id, request.body || {});

    if (!job) {
      response.status(404).json({ message: "Job was not found." });
      return;
    }

    response.json({ job });
  })
);

app.post(
  "/api/jobs/:id/analyze",
  asyncRoute(async (request, response) => {
    const job = await getJob(request.auth.user._id, request.params.id);

    if (!job) {
      response.status(404).json({ message: "Job was not found." });
      return;
    }

    const cvId = request.body?.cvId || job.cvId;
    if (!cvId) {
      response.status(400).json({ message: "Select a CV before analyzing this job." });
      return;
    }

    const cv = await getCv(request.auth.user._id, cvId);
    if (!cv) {
      response.status(404).json({ message: "Selected CV was not found." });
      return;
    }

    const jobDescription = job.description || [job.title, job.company, job.location].filter(Boolean).join("\n");
    if (!jobDescription) {
      response.status(400).json({ message: "This saved job does not include enough text to analyze." });
      return;
    }

    const result = await runApplicationAgent({
      cvText: cv.text,
      jobDescription,
      jobUrl: job.url || ""
    });
    const runId = await saveRun(request.auth.user._id, {
      cvId: cv._id,
      cvFileName: cv.fileName,
      companyName: result.companyName || job.company || "",
      roleTitle: result.roleTitle || job.title || "",
      jobDescription,
      jobUrl: job.url || "",
      sourceJobId: job._id,
      result
    });

    await updateJobState(request.auth.user._id, request.params.id, { viewed: true });

    response.json({
      id: runId.toString(),
      ...result
    });
  })
);

app.get(
  "/api/applications/runs",
  asyncRoute(async (_request, response) => {
    response.json({ runs: await listRuns(_request.auth.user._id) });
  })
);

app.patch(
  "/api/applications/runs/:id/status",
  asyncRoute(async (request, response) => {
    const run = await updateRunStatus(request.auth.user._id, request.params.id, request.body.status);

    if (!run) {
      response.status(404).json({ message: "Match record was not found." });
      return;
    }

    response.json({ run });
  })
);

app.patch(
  "/api/applications/runs/:id/stage-data",
  asyncRoute(async (request, response) => {
    const run = await updateRunStageData(
      request.auth.user._id,
      request.params.id,
      request.body || {}
    );

    if (!run) {
      response.status(404).json({ message: "Match record was not found." });
      return;
    }

    response.json({ run });
  })
);

app.post(
  "/api/applications/runs/:id/coach",
  asyncRoute(async (request, response) => {
    const run = await getRun(request.auth.user._id, request.params.id);

    if (!run) {
      response.status(404).json({ message: "Match record was not found." });
      return;
    }

    const coachInsights = await runCoachAgent(run);
    const updatedRun = await saveRunCoachInsights(
      request.auth.user._id,
      request.params.id,
      coachInsights
    );

    response.json({ run: updatedRun, coachInsights });
  })
);

app.post(
  "/api/applications/runs/:id/rerun",
  asyncRoute(async (request, response) => {
    const run = await getRun(request.auth.user._id, request.params.id);

    if (!run) {
      response.status(404).json({ message: "Match record was not found." });
      return;
    }

    const cvId = request.body?.cvId || run.cvId;
    if (!cvId) {
      response.status(400).json({ message: "Select a CV before re-running analysis." });
      return;
    }

    const cv = await getCv(request.auth.user._id, cvId);
    if (!cv) {
      response.status(404).json({ message: "Selected CV was not found." });
      return;
    }

    const jobDescription = run.jobDescription || "";
    if (!jobDescription) {
      response.status(400).json({ message: "This record does not have a saved JD to analyze." });
      return;
    }

    const result = await runApplicationAgent({
      cvText: cv.text,
      jobDescription,
      jobUrl: run.jobUrl || ""
    });
    const updatedRun = await updateRunAnalysis(request.auth.user._id, request.params.id, {
      cv,
      result
    });

    response.json({ run: updatedRun });
  })
);

app.delete(
  "/api/applications/runs/:id",
  asyncRoute(async (request, response) => {
    const deleted = await deleteRun(request.auth.user._id, request.params.id);
    response.json({ deleted });
  })
);

app.post(
  "/api/applications/run",
  asyncRoute(async (request, response) => {
    const { cvId, jobDescription = "", jobUrl = "" } = request.body;

    if (!cvId) {
      response.status(400).json({ message: "Select or upload a CV first." });
      return;
    }

    const cv = await getCv(request.auth.user._id, cvId);
    if (!cv) {
      response.status(404).json({ message: "Selected CV was not found." });
      return;
    }

    const loadedJobDescription = await loadJobDescription({ jobDescription, jobUrl });
    if (!loadedJobDescription) {
      response.status(400).json({ message: "Paste a job description or provide a job link." });
      return;
    }

    const result = await runApplicationAgent({
      cvText: cv.text,
      jobDescription: loadedJobDescription,
      jobUrl
    });
    const runId = await saveRun(request.auth.user._id, {
      cvId: cv._id,
      cvFileName: cv.fileName,
      companyName: result.companyName || "",
      roleTitle: result.roleTitle || "",
      jobDescription: loadedJobDescription,
      jobUrl,
      result
    });

    response.json({
      id: runId.toString(),
      ...result
    });
  })
);

app.listen(port, () => {
  console.log(`Job assistant API listening on http://localhost:${port}`);
});
