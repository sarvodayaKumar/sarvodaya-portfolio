// Generates one new blog post using Claude and writes it to content/blog/.
// Run daily by .github/workflows/daily-blog-post.yml. Requires ANTHROPIC_API_KEY.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOG_DIR = path.join(root, "content", "blog");
const MODEL = "claude-sonnet-5";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

function loadExistingPosts() {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  return files.map((file) => {
    const raw = readFileSync(path.join(BLOG_DIR, file), "utf8");
    const { data } = matter(raw);
    return { slug: file.replace(/\.md$/, ""), title: String(data.title ?? ""), tags: data.tags ?? [] };
  });
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function uniqueSlug(base, existingSlugs) {
  if (!existingSlugs.has(base)) return base;
  let n = 2;
  while (existingSlugs.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const existing = loadExistingPosts();
const existingSlugs = new Set(existing.map((p) => p.slug));
const existingTitles = existing.map((p) => `- ${p.title}`).join("\n");

const client = new Anthropic({ apiKey });

const TECH_STACK = [
  "Go", "C", "Docker", "Kubernetes", "Helm", "Jenkins", "CI/CD pipelines", "Bash", "Git",
  "Azure", "Azure DevOps", "Terraform", "Ansible", "Prometheus", "Grafana", "Trivy",
  "JFrog Artifactory", "Linux (RHEL/Ubuntu)", "networking fundamentals", "RESTful APIs",
  "gRPC", "Postgres",
];

const prompt = `You write technical blog posts for a senior cloud backend engineer's personal blog. \
The blog covers this engineer's actual stack: ${TECH_STACK.join(", ")} — practical, hands-on \
engineering topics, the kind a working engineer would actually search for when debugging or \
designing something. Draw topics from across this whole stack over time, not just one corner of it.

Style, matching the existing posts exactly:
- First-person-adjacent but not autobiographical; direct, confident, no fluff or hedging
- Opens with a short paragraph framing why the topic actually matters, not a dictionary definition
- Uses "## " section headings, each covering one concrete idea or pitfall
- Includes real, correct code snippets (Go, YAML, HCL, Bash, PromQL, etc. depending on topic) in fenced code blocks
- 700-950 words total
- Ends with a section that ties the specific technique back to the real-world consequence of getting it wrong
- No emoji, no bullet-point-only sections, no generic "in conclusion" filler

Topics already covered on this blog — pick something genuinely different, not a rehash:
${existingTitles}

Pick ONE specific, practical topic from anywhere in that stack that is not covered above, and write \
the full post. Respond with ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{"title": string, "summary": string (one sentence, matches the tone of a subtitle), "tags": string[] (one or more short lowercase tags naming the specific technologies covered, e.g. "go", "kubernetes", "terraform", "azure", "docker", "ci-cd", "observability", "networking", "postgres"), "body": string (the full post body in markdown, starting directly with the opening paragraph — no title heading, no frontmatter)}`;

const response = await client.messages.create({
  model: MODEL,
  max_tokens: 4096,
  messages: [{ role: "user", content: prompt }],
});

const text = response.content.find((block) => block.type === "text")?.text ?? "";

let post;
try {
  post = JSON.parse(text);
} catch (err) {
  console.error("Failed to parse model response as JSON:\n", text);
  throw err;
}

if (!post.title || !post.summary || !post.body || !Array.isArray(post.tags)) {
  console.error("Model response missing required fields:", post);
  process.exit(1);
}

const slug = uniqueSlug(slugify(post.title), existingSlugs);
const date = new Date().toISOString().slice(0, 10);

const frontmatter = [
  "---",
  `title: ${JSON.stringify(post.title)}`,
  `date: "${date}"`,
  `summary: ${JSON.stringify(post.summary)}`,
  "published: true",
  `tags: [${post.tags.join(", ")}]`,
  "---",
  "",
].join("\n");

const filePath = path.join(BLOG_DIR, `${slug}.md`);
writeFileSync(filePath, frontmatter + post.body.trim() + "\n");
console.log(`Wrote ${filePath}`);
