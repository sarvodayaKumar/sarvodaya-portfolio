import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-zap-report.mjs', import.meta.url));
async function runWithReport(report) {
  const dir = await mkdtemp(join(tmpdir(), 'zap-report-'));
  try {
    const path = join(dir, 'report.json');
    await writeFile(path, JSON.stringify(report));
    return spawnSync(process.execPath, [script, path], { encoding: 'utf8' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('fails on high-risk ZAP alerts', async () => {
  const result = await runWithReport({ site: [{ alerts: [{ alert: 'Example high risk', riskcode: '3' }] }] });
  assert.equal(result.status, 1);
});
test('passes when findings are medium or lower', async () => {
  const result = await runWithReport({ site: [{ alerts: [{ alert: 'Medium', riskcode: '2' }, { alert: 'Low', riskcode: '1' }] }] });
  assert.equal(result.status, 0, result.stderr);
});
test('passes an empty report', async () => {
  const result = await runWithReport({ site: [{ alerts: [] }] });
  assert.equal(result.status, 0, result.stderr);
});
