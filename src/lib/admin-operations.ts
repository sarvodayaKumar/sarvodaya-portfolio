export type AdminWorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, fallback: string, maxLength = 160): string {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, maxLength)
    : fallback;
}

function safeGitHubUrl(value: unknown): string {
  if (typeof value !== "string") return "https://github.com/sarvodayaKumar/sarvodaya-portfolio/actions";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com"
      ? url.toString()
      : "https://github.com/sarvodayaKumar/sarvodaya-portfolio/actions";
  } catch {
    return "https://github.com/sarvodayaKumar/sarvodaya-portfolio/actions";
  }
}

/** Keep only the small, non-sensitive subset of public workflow-run fields used by the admin UI. */
export function normalizeWorkflowRuns(payload: unknown): AdminWorkflowRun[] {
  if (!isRecord(payload) || !Array.isArray(payload.workflow_runs)) return [];

  return payload.workflow_runs.slice(0, 8).flatMap((value) => {
    if (!isRecord(value) || !Number.isSafeInteger(value.id)) return [];
    return [{
      id: value.id as number,
      name: safeText(value.name, "GitHub Actions workflow"),
      status: safeText(value.status, "unknown", 32),
      conclusion: typeof value.conclusion === "string" ? value.conclusion.slice(0, 32) : null,
      branch: safeText(value.head_branch, "unknown", 120),
      url: safeGitHubUrl(value.html_url),
      createdAt: safeText(value.created_at, ""),
      updatedAt: safeText(value.updated_at, ""),
    }];
  });
}

export function summarizeWorkflowRuns(runs: AdminWorkflowRun[]) {
  return {
    total: runs.length,
    running: runs.filter((run) => run.status === "in_progress" || run.status === "queued").length,
    successful: runs.filter((run) => run.status === "completed" && run.conclusion === "success").length,
    failed: runs.filter((run) => run.status === "completed" && run.conclusion !== "success" && run.conclusion !== "cancelled" && run.conclusion !== "skipped").length,
  };
}
