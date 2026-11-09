import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWorkflowRuns,
  summarizeWorkflowRuns,
} from "../src/lib/admin-operations.ts";

test("workflow normalization limits results and exposes only approved fields", () => {
  const runs = normalizeWorkflowRuns({
    workflow_runs: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: "CI",
      status: "completed",
      conclusion: "success",
      head_branch: "main",
      html_url: "https://github.com/example/repo/actions/runs/1",
      created_at: "2026-11-09T10:00:00Z",
      updated_at: "2026-11-09T10:01:00Z",
      actor: { login: "private-detail-not-needed" },
      head_commit: { message: "not exposed" },
    })),
  });

  assert.equal(runs.length, 8);
  assert.deepEqual(Object.keys(runs[0]).sort(), [
    "branch", "conclusion", "createdAt", "id", "name", "status", "updatedAt", "url",
  ]);
  assert.equal(runs[0].url, "https://github.com/example/repo/actions/runs/1");
});

test("workflow normalization rejects malformed payloads and unsafe links", () => {
  assert.deepEqual(normalizeWorkflowRuns(null), []);
  assert.deepEqual(normalizeWorkflowRuns({ workflow_runs: "invalid" }), []);
  const [run] = normalizeWorkflowRuns({
    workflow_runs: [{
      id: 7,
      html_url: "javascript:alert(1)",
      name: "x".repeat(300),
      status: "in_progress",
    }],
  });
  assert.equal(run.url, "https://github.com/sarvodayaKumar/sarvodaya-portfolio/actions");
  assert.equal(run.name.length, 160);
});

test("workflow summary distinguishes running, successful, and failed runs", () => {
  const runs = normalizeWorkflowRuns({
    workflow_runs: [
      { id: 1, status: "in_progress" },
      { id: 2, status: "queued" },
      { id: 3, status: "completed", conclusion: "success" },
      { id: 4, status: "completed", conclusion: "failure" },
      { id: 5, status: "completed", conclusion: "cancelled" },
    ],
  });
  assert.deepEqual(summarizeWorkflowRuns(runs), {
    total: 5,
    running: 2,
    successful: 1,
    failed: 1,
  });
});
