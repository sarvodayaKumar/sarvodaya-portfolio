import fs from "node:fs";

const reportPath = process.argv[2] ?? "npm-audit.json";

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Unable to read npm audit report at ${reportPath}: ${error.message}`);
  process.exit(2);
}

if (report.error) {
  console.error("npm audit did not complete successfully:", report.error);
  process.exit(2);
}

const counts = report.metadata?.vulnerabilities ?? {};
const critical = Number(counts.critical ?? 0);
const high = Number(counts.high ?? 0);
const moderate = Number(counts.moderate ?? 0);
const low = Number(counts.low ?? 0);
const info = Number(counts.info ?? 0);
const summary = `Critical: ${critical} | High: ${high} | Moderate: ${moderate} | Low: ${low} | Info: ${info}`;

console.log("Dependency vulnerability summary");
console.log(summary);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\n`);
}

if (critical > 0 || high > 0) {
  console.error("Security gate failed: remediate all high and critical dependency vulnerabilities.");
  for (const [name, finding] of Object.entries(report.vulnerabilities ?? {})) {
    if (["high", "critical"].includes(finding.severity)) {
      console.error(`- ${name}: ${finding.severity}; direct=${finding.isDirect}; range=${finding.range}`);
    }
  }
  process.exit(1);
}

console.log("Security gate passed: no high or critical npm audit findings.");
