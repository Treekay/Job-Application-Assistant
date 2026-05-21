const SOURCE_CONFIG = {
  indeed: {
    label: "Indeed",
    searchUrl({ keywords, location }) {
      const params = new URLSearchParams({
        q: keywords,
        l: location
      });
      return `https://nz.indeed.com/jobs?${params.toString()}`;
    }
  },
  seek: {
    label: "SEEK",
    searchUrl({ keywords, location }) {
      const query = encodeURIComponent(keywords.trim().replace(/\s+/g, "-"));
      const where = encodeURIComponent(location.trim().replace(/\s+/g, "-"));
      return `https://www.seek.co.nz/${query}-jobs/in-${where}`;
    }
  },
  linkedin: {
    label: "LinkedIn",
    searchUrl({ keywords, location }) {
      const params = new URLSearchParams({
        keywords,
        location
      });
      return `https://www.linkedin.com/jobs/search?${params.toString()}`;
    }
  }
};

const TECH_KEYWORDS = [
  "javascript",
  "typescript",
  "react",
  "node",
  "node.js",
  "express",
  "python",
  "java",
  "go",
  "golang",
  "c++",
  "erlang",
  "mongodb",
  "mysql",
  "postgres",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "linux",
  "nginx",
  "ci/cd",
  "github actions",
  "jenkins",
  "api",
  "rest",
  "oauth",
  "jwt",
  "openai",
  "llm",
  "cloud",
  "backend",
  "full-stack",
  "full stack",
  "software engineer",
  "developer",
  "graduate",
  "junior",
  "internship"
];

const WORK_RIGHT_PATTERNS = [
  {
    status: "restricted",
    label: "NZ citizen or permanent resident",
    patterns: [
      /new zealand citizen(?:ship)?(?:\s+or\s+(?:new zealand\s+)?permanent resident)?/i,
      /nz citizen(?:ship)?(?:\s+or\s+(?:nz\s+)?permanent resident)?/i,
      /citizens? or permanent residents?/i,
      /permanent working rights/i
    ]
  },
  {
    status: "open_work_rights",
    label: "Valid NZ work rights",
    patterns: [
      /legally entitled to work in (?:new zealand|nz)/i,
      /legal right to work in (?:new zealand|nz)/i,
      /valid (?:new zealand|nz)?\s*work visa/i,
      /valid working rights/i,
      /full working rights/i,
      /right to work in (?:new zealand|nz)/i
    ]
  },
  {
    status: "no_sponsorship",
    label: "No sponsorship mentioned",
    patterns: [/no sponsorship/i, /sponsorship (?:is )?not (?:available|provided)/i]
  }
];

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

function cleanText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanField(value = "", maxLength = 280) {
  return cleanText(value).slice(0, maxLength);
}

function absoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function getSourceFromUrl(url = "") {
  const host = url.toLowerCase();
  if (host.includes("seek.co")) return "seek";
  if (host.includes("indeed.")) return "indeed";
  if (host.includes("linkedin.")) return "linkedin";
  return "manual";
}

function sourceJobIdFromUrl(url = "") {
  const patterns = [
    /[?&]jk=([^&]+)/i,
    /\/job\/(\d+)/i,
    /\/jobs\/view\/[^/]*?(\d{6,})/i,
    /\/viewjob\?jk=([^&]+)/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  return "";
}

function slug(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function dedupeKeyFor(job) {
  if (job.sourceJobId) {
    return `${job.source}:${job.sourceJobId}`;
  }

  return `${slug(job.company)}:${slug(job.title)}:${slug(job.location)}`;
}

function extractTitle(html, url) {
  const titlePatterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return cleanField(match[1].replace(/\s*[-|]\s*(LinkedIn|Indeed|SEEK).*$/i, ""), 180);
    }
  }

  return sourceJobIdFromUrl(url) ? `Job ${sourceJobIdFromUrl(url)}` : "Untitled role";
}

function extractCompany(html, text) {
  const metaMatch = html.match(
    /<meta[^>]+(?:property|name)=["'](?:og:site_name|company)["'][^>]+content=["']([^"']+)["']/i
  );
  if (metaMatch?.[1]) return cleanField(metaMatch[1], 160);

  const companyPatterns = [
    /Company\s*[:\-]\s*([^|,]{2,80})/i,
    /at\s+([A-Z][A-Za-z0-9&.,' -]{2,70})\s+(?:in|on|posted)/i,
    /hiring\s+(.{2,80}?)\s+in/i
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanField(match[1], 160);
  }

  return "";
}

function extractLocation(text) {
  const match = text.match(
    /\b(Auckland|Wellington|Christchurch|Hamilton|Dunedin|Tauranga|New Zealand|Remote|Hybrid)\b[^.,|]{0,40}/i
  );
  return match ? cleanField(match[0], 120) : "";
}

function parseDate(day, month, year) {
  const monthIndex = MONTHS[String(month).toLowerCase()];
  if (monthIndex === undefined) return null;
  const fullYear = Number(year || new Date().getFullYear());
  const date = new Date(Date.UTC(fullYear, monthIndex, Number(day), 23, 59, 59));
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractClosingDate(text) {
  const patterns = [
    /applications?\s+close[s]?\s*(?:on)?\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+),?\s*(20\d{2})?/i,
    /application\s+closes\s+on\s+(\d{1,2})\s+([a-z]+)\s*(20\d{2})?/i,
    /apply\s+by\s+(\d{1,2})\s+([a-z]+)\s*(20\d{2})?/i,
    /closing\s+date\s*[:\-]?\s*(\d{1,2})\s+([a-z]+)\s*(20\d{2})?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const date = match ? parseDate(match[1], match[2], match[3]) : null;
    if (date) return date;
  }

  return null;
}

function extractPostedAt(text) {
  const relative = text.match(/posted\s+(\d+)\s+(day|week|month)s?\s+ago/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const date = new Date();
    if (unit === "day") date.setDate(date.getDate() - amount);
    if (unit === "week") date.setDate(date.getDate() - amount * 7);
    if (unit === "month") date.setMonth(date.getMonth() - amount);
    return date;
  }

  const posted = text.match(/posted\s+(?:on\s+)?(\d{1,2})\s+([a-z]+)\s*(20\d{2})?/i);
  return posted ? parseDate(posted[1], posted[2], posted[3]) : null;
}

function classifyWorkRights(text) {
  for (const rule of WORK_RIGHT_PATTERNS) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        status: rule.status,
        label: rule.label
      };
    }
  }

  return {
    status: "unknown",
    label: "Not found"
  };
}

function tokenize(text = "") {
  return cleanText(text)
    .toLowerCase()
    .match(/[a-z][a-z0-9+#./-]{1,}/g) || [];
}

export function extractCvKeywords(cvText = "", limit = 28) {
  const lowerCv = cvText.toLowerCase();
  const explicit = TECH_KEYWORDS.filter((keyword) => lowerCv.includes(keyword.toLowerCase()));
  const tokens = tokenize(cvText).filter((token) => token.length > 2 && !/^\d+$/.test(token));
  const counts = new Map();

  tokens.forEach((token) => {
    if (
      [
        "with",
        "from",
        "this",
        "that",
        "current",
        "experience",
        "developer",
        "project",
        "system",
        "systems"
      ].includes(token)
    ) {
      return;
    }
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  const inferred = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, limit);

  return [...new Set([...explicit, ...inferred])].slice(0, limit);
}

export function scoreJobAgainstCv(job, cvText = "", preferredKeywords = []) {
  const keywords = [...new Set([...preferredKeywords, ...extractCvKeywords(cvText)])]
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 48);
  const haystack = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  const matchedKeywords = keywords.filter((keyword) => haystack.includes(keyword));
  const matchScore = keywords.length ? Math.round((matchedKeywords.length / keywords.length) * 100) : 0;

  return {
    matchScore,
    matchedKeywords: matchedKeywords.slice(0, 16),
    keywordCount: keywords.length
  };
}

export function parseJobPage({ html, url }) {
  const text = cleanText(html);
  const source = getSourceFromUrl(url);
  const title = extractTitle(html, url);
  const company = extractCompany(html, text);
  const location = extractLocation(text);
  const closingDate = extractClosingDate(text);
  const postedAt = extractPostedAt(text);
  const workRights = classifyWorkRights(text);
  const sourceJobId = sourceJobIdFromUrl(url);
  const description = text.slice(0, 12000);

  const job = {
    source,
    sourceLabel: SOURCE_CONFIG[source]?.label || "Manual",
    sourceJobId,
    dedupeKey: "",
    title,
    company,
    location,
    url,
    description,
    postedAt,
    closingDate,
    isOpen: closingDate ? closingDate >= new Date() : true,
    workRights,
    scrapedAt: new Date()
  };

  job.dedupeKey = dedupeKeyFor(job);
  return job;
}

function extractLikelyJobLinks(html, baseUrl, source) {
  const links = [];
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html))) {
    const href = match[1];
    const label = cleanText(match[2]);
    const url = absoluteUrl(href, baseUrl);
    if (!url) continue;

    const looksLikeJob =
      /\/viewjob\?|[?&]jk=|\/job\/|\/jobs\/view\//i.test(url) ||
      /job|developer|engineer|graduate|analyst/i.test(label);

    if (looksLikeJob && getSourceFromUrl(url) === source) {
      links.push(url);
    }
  }

  return [...new Set(links)].slice(0, 12);
}

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-NZ,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ApplyAgentJobFeed/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status}).`);
  }

  return response.text();
}

export async function scrapeJobUrls(urls = []) {
  const jobs = [];
  const errors = [];

  for (const url of urls.map((item) => item.trim()).filter(Boolean)) {
    try {
      const html = await fetchText(url);
      jobs.push(parseJobPage({ html, url }));
    } catch (error) {
      errors.push({ url, message: error.message });
    }
  }

  return { jobs, errors };
}

export async function scrapeJobSearch({ sources = [], keywords = "", location = "Auckland" }) {
  const searchSources = sources.filter((source) => SOURCE_CONFIG[source]);
  const discoveredUrls = [];
  const errors = [];

  for (const source of searchSources) {
    const searchUrl = SOURCE_CONFIG[source].searchUrl({ keywords, location });
    try {
      const html = await fetchText(searchUrl);
      discoveredUrls.push(...extractLikelyJobLinks(html, searchUrl, source));
    } catch (error) {
      errors.push({ url: searchUrl, message: error.message });
    }
  }

  const scraped = await scrapeJobUrls([...new Set(discoveredUrls)].slice(0, 20));
  return {
    jobs: scraped.jobs,
    errors: [...errors, ...scraped.errors],
    discoveredCount: discoveredUrls.length
  };
}
