#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'report_json.json';
let report;
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch (error) {
  console.error('Unable to read ZAP JSON report at ' + reportPath + ': ' + error.message);
  process.exit(2);
}

const alerts = [];
function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) visit(item);
    return;
  }
  if (Object.hasOwn(value, 'riskcode') && Object.hasOwn(value, 'alert')) {
    alerts.push(value);
  }
  for (const child of Object.values(value)) visit(child);
}
visit(report);

const risk = (alert) => Number.parseInt(String(alert.riskcode ?? '0'), 10) || 0;
const high = alerts.filter((alert) => risk(alert) >= 3);
const medium = alerts.filter((alert) => risk(alert) === 2);
const low = alerts.filter((alert) => risk(alert) === 1);
const info = alerts.filter((alert) => risk(alert) === 0);

console.log('ZAP findings: ' + high.length + ' high, ' + medium.length + ' medium, ' + low.length + ' low, ' + info.length + ' informational.');
for (const alert of high) {
  console.error('HIGH: ' + (alert.alert ?? 'Unknown alert') + ' — ' + (alert.name ?? ''));
}
if (high.length > 0) {
  console.error('DAST gate failed: resolve or formally triage all high-risk findings.');
  process.exit(1);
}
console.log('DAST severity gate passed. Medium and lower findings remain reportable for triage.');
