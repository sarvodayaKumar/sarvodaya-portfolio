import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = process.env.RESUME_PATH || "/mnt/d/Download/sarvodayaKumar.pdf";
const CONTENT_PDF = path.join(root, "content", "resume.pdf");
const PUBLIC_PDF = path.join(root, "public", "resume.pdf");
const TEXT_OUT = path.join(root, "content", "resume.txt");
const META_OUT = path.join(root, "content", "resume.meta.json");
const OVERRIDES = path.join(root, "content", "profile.overrides.json");
const PROFILE_OUT = path.join(root, "src", "data", "profile.ts");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function section(text, name) {
  const names = [name, name.toUpperCase(), name.replace("I", "i")];
  const pattern = names
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`(?:^|\\n)(${pattern})\\n([\\s\\S]*?)(?=\\n(?:SUMMARY|CERTIfiCATION|CERTIFICATION|SKILLS|EXPERIENCE|EDUCATION)\\n|$)`, "i");
  const match = text.match(re);
  return match ? match[2].trim() : "";
}

function tidy(text) {
  return text
    .replace(/\s*\(use your quantifiable results\)/gi, "")
    .replace(/\s*\(or Terraform, Jenkins\)/gi, " with Terraform and Jenkins")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(text, max = 92) {
  const clean = tidy(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 50 ? at : max)}…`;
}

function splitCsv(value) {
  const out = [];
  let current = "";
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseSkills(block) {
  const joined = [];
  for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (!line.includes(":") && joined.length) {
      joined[joined.length - 1] += ` ${line}`;
    } else {
      joined.push(line);
    }
  }
  const techStack = {};
  for (const line of joined) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const values = splitCsv(line.slice(idx + 1))
      .map((v) => v.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (key && values.length) techStack[key] = values;
  }
  return techStack;
}

function parseExperience(block) {
  const jobs = [];
  const lines = block.split("\n");
  let current = null;
  let buffer = [];

  const flushHighlight = () => {
    if (!current || !buffer.length) return;
    const text = tidy(buffer.join(" "));
    if (text) current.highlights.push(text);
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(
      /^(.+?)\s+\|\s+(.+?)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s+[–-]\s+(?:Present|[A-Za-z]+\s+\d{4}))$/i
    );
    if (header) {
      flushHighlight();
      if (current) jobs.push(current);
      current = {
        role: header[1].trim(),
        company: header[2].trim(),
        period: header[3].replace(/-/g, "–").trim(),
        focus: "",
        highlights: [],
      };
      continue;
    }
    if (line.startsWith("–")) {
      flushHighlight();
      buffer = [line.replace(/^–\s*/, "")];
    } else if (current) {
      buffer.push(line);
    }
  }
  flushHighlight();
  if (current) jobs.push(current);

  for (const job of jobs) {
    job.focus = snippet(job.highlights[0] || job.role);
  }
  return jobs;
}

function parseEducation(block) {
  const compact = block.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const match = compact.match(
    /^(.+?)\s+(B\.Tech in [^|]+)\s+\|\s+([^0-9]+?)\s+([A-Za-z]+\s+\d{4}\s+[–-]\s+[A-Za-z]+\s+\d{4})/i
  );
  if (!match) {
    return {
      degree: compact,
      school: "",
      period: "",
    };
  }
  return {
    degree: match[2].trim(),
    school: `${match[1].trim()}, ${match[3].trim()}`,
    period: match[4].replace(/-/g, "–").trim(),
  };
}

function parseCerts(block) {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const certs = [];
  let current = null;
  for (const line of lines) {
    if (!line.startsWith("–")) {
      if (current) certs.push(current);
      current = { name: line, detail: "", status: "completed" };
      continue;
    }
    if (!current) continue;
    const value = line.replace(/^–\s*/, "");
    if (/credential id/i.test(value)) {
      current.detail = [current.detail, value].filter(Boolean).join(" · ");
    } else if (/date/i.test(value)) {
      current.detail = [current.detail, value.replace(/^Date\s*:\s*/i, "Issued ")].filter(Boolean).join(" · ");
    } else {
      current.detail = [current.detail, value].filter(Boolean).join(" · ");
    }
  }
  if (current) certs.push(current);
  return certs;
}

function expertiseFromSkills(techStack) {
  const get = (partial) =>
    Object.entries(techStack).find(([key]) => key.toLowerCase().includes(partial))?.[1] || [];

  return [
    {
      icon: "code",
      title: "Backend systems",
      items: get("language").slice(0, 3).length
        ? [
            `${get("language").join(" · ")}`,
            ...(get("api").slice(0, 2).length ? [`${get("api").join(", ")}`] : ["REST and gRPC services"]),
            "Production microservices and API design",
          ]
        : ["Go services", "REST and gRPC APIs", "Secure service communication"],
    },
    {
      icon: "cloud",
      title: "Cloud & infrastructure",
      items: (get("cloud").length ? get("cloud") : ["Azure", "Terraform", "Ansible"]).slice(0, 3),
    },
    {
      icon: "activity",
      title: "Delivery & platforms",
      items: (get("devops").length ? get("devops") : ["Docker", "Kubernetes", "CI/CD"]).slice(0, 3),
    },
    {
      icon: "shield",
      title: "Observability & security",
      items: (get("monitor").length ? get("monitor") : ["Prometheus", "Grafana", "Trivy"]).slice(0, 3),
    },
  ];
}

function toTs(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const keyName = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    }
    return `[\n${value.map((v) => `${pad}  ${toTs(v, indent + 1)}`).join(",\n")}\n${pad}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${pad}  ${keyName(k)}: ${toTs(v, indent + 1)}`);
    return `{\n${entries.join(",\n")}\n${pad}}`;
  }
  return JSON.stringify(value);
}

function parseResume(text) {
  const cleaned = text.replace(/\r/g, "").replace(/-- \d+ of \d+ --/g, "").trim();
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0] || "Sarvodaya Kumar";
  const header = lines.find((l) => l.includes("|") && /engineer|outlook|github/i.test(l)) || "";
  const emailMatch = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = cleaned.match(/\+91[-\s]?\d{10}/);
  const parts = header.split("|").map((p) => p.trim());
  const title = parts[0] || "Senior Software Engineer";
  const location = parts.find((p) => /bangalore|karnataka|india/i.test(p)) || parts[1] || "";
  const summary = section(cleaned, "SUMMARY").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const techStack = parseSkills(section(cleaned, "SKILLS"));
  const experience = parseExperience(section(cleaned, "EXPERIENCE"));
  const education = parseEducation(section(cleaned, "EDUCATION"));
  const certifications = parseCerts(section(cleaned, "CERTIfiCATION") || section(cleaned, "CERTIFICATION"));

  const years = summary.match(/(\d+)\+?\s+years/i)?.[1];
  return {
    name,
    title,
    location,
    phone: phoneMatch?.[0] || "",
    email: emailMatch?.[0] || "",
    summary,
    techStack,
    experience,
    education,
    certifications,
    years: years ? `${years}+` : "5+",
  };
}

function buildProfile(parsed, overrides) {
  const email = parsed.email || overrides.links?.email;
  const specialtyBits = Object.values(parsed.techStack).flat().slice(0, 4);
  return {
    name: parsed.name,
    title: overrides.title || parsed.title,
    specialty: parsed.location
      ? `${parsed.location} · ${specialtyBits.slice(0, 3).join(" · ")}`
      : specialtyBits.slice(0, 3).join(" · "),
    tagline: overrides.tagline || parsed.summary,
    avatar: overrides.avatar || "/profile.png",
    experienceYears: parsed.years,
    status: overrides.status || "Open to collaboration",
    resumeUrl: overrides.resumeUrl || "/resume.pdf",
    typingLines: overrides.typingLines || [
      parsed.experience[0] ? `${parsed.experience[0].role} @ ${parsed.experience[0].company}` : parsed.title,
      overrides.openSource?.length
        ? "Open source: sensu-go and terraform-provider-aquasec"
        : specialtyBits[0]
          ? `Building with ${specialtyBits.slice(0, 3).join(", ")}`
          : "Building production systems",
      "Open to senior engineering conversations",
    ],
    links: {
      linkedin: overrides.links?.linkedin || "",
      email,
      github: overrides.links?.github || "",
      workGithub: overrides.links?.workGithub || "",
      instagram: overrides.links?.instagram || "",
      phone: parsed.phone ? `tel:${parsed.phone.replace(/\s/g, "")}` : undefined,
    },
    currentFocus: {
      role: parsed.experience[0]
        ? `${parsed.experience[0].role}, ${parsed.experience[0].company}`
        : parsed.title,
      contributions: (overrides.contributions || []).map((c) => c.repo).join(", "),
      workHandle: overrides.links?.workGithub?.split("/").pop()
        ? `@${overrides.links.workGithub.split("/").pop()}`
        : "",
      techStack: specialtyBits.join(", "),
      focusAreas: snippet(parsed.experience[0]?.highlights[0] || parsed.title, 140),
    },
    about: overrides.about || [
      parsed.summary,
      overrides.openSourceAbout,
      parsed.experience[1]?.highlights[0],
    ].filter(Boolean),
    expertise: expertiseFromSkills(parsed.techStack),
    contributions: overrides.contributions || [],
    openSource: overrides.openSource || [],
    employment: parsed.experience.map((job) => ({ ...job, type: "employment" })),
    techStack: parsed.techStack,
    stats: [
      { value: parsed.years, label: "Years in production" },
      {
        value: String((overrides.contributions || []).length || (overrides.openSource || []).length),
        label: "OSS repositories",
      },
      { value: Object.values(parsed.techStack)[0]?.[0] || "Go", label: "Primary language" },
      { value: parsed.location.split(",")[0] || "Bangalore", label: "Based in" },
    ],
    experience: [
      ...(overrides.openSource || []),
      ...parsed.experience.map((job) => ({ ...job, type: "employment" })),
    ],
    projects: overrides.projects || [],
    certifications: parsed.certifications,
    education: parsed.education,
  };
}

async function extractText(pdfPath) {
  const data = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  if (typeof parser.destroy === "function") await parser.destroy();
  return result.text;
}

async function sync() {
  const source = argValue("--source") || DEFAULT_SOURCE;
  if (!fs.existsSync(source)) {
    throw new Error(`Resume not found: ${source}`);
  }

  fs.mkdirSync(path.join(root, "content"), { recursive: true });
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.copyFileSync(source, CONTENT_PDF);
  fs.copyFileSync(source, PUBLIC_PDF);

  const text = await extractText(CONTENT_PDF);
  fs.writeFileSync(TEXT_OUT, text);
  const hash = createHash("sha256").update(fs.readFileSync(CONTENT_PDF)).digest("hex").slice(0, 16);
  fs.writeFileSync(
    META_OUT,
    JSON.stringify(
      {
        source,
        hash,
        syncedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const overrides = JSON.parse(fs.readFileSync(OVERRIDES, "utf8"));
  const parsed = parseResume(text);
  const profile = buildProfile(parsed, overrides);
  const file = `// Generated by scripts/sync-resume.mjs from the resume PDF.
// Links, OSS, and projects live in content/profile.overrides.json.

export const profile = ${toTs(profile)};
`;
  fs.writeFileSync(PROFILE_OUT, file);
  console.log(`Synced resume from ${source}`);
  console.log(`Wrote ${path.relative(root, PUBLIC_PDF)} and ${path.relative(root, PROFILE_OUT)}`);
}

const watch = process.argv.includes("--watch");
await sync();

if (watch) {
  const { watch: watchFiles } = await import("chokidar");
  const source = argValue("--source") || DEFAULT_SOURCE;
  const targets = [source, CONTENT_PDF, OVERRIDES].filter((p) => fs.existsSync(p));
  console.log(`Watching resume + overrides:\n  ${targets.join("\n  ")}`);
  watchFiles(targets, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
    usePolling: true,
    interval: 1000,
  }).on("all", async (event, file) => {
    console.log(`${event} ${file}`);
    try {
      await sync();
    } catch (error) {
      console.error(error);
    }
  });
}
