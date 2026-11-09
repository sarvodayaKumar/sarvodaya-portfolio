import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const script = new URL('./validate-dast-target.mjs', import.meta.url);
const baseEnv = { ...process.env, DAST_ALLOWED_HOSTS: 'staging.example.test,preview.example.test', DAST_PRODUCTION_HOSTS: 'www.example.test' };
function run(target, extraEnv = {}) {
  return spawnSync(process.execPath, [script.pathname, target], { encoding: 'utf8', env: { ...baseEnv, ...extraEnv } });
}

test('accepts an HTTPS host explicitly allowlisted for staging', () => {
  const result = run('https://staging.example.test/app');
  assert.equal(result.status, 0, result.stderr);
});
test('rejects an unlisted host, including production', () => {
  assert.notEqual(run('https://attacker.example.test').status, 0);
  assert.notEqual(run('https://www.example.test').status, 0);
});
test('rejects HTTP, credentials, query strings and fragments', () => {
  for (const target of ['http://staging.example.test', 'https://user:pass@staging.example.test', 'https://staging.example.test/?token=secret', 'https://staging.example.test/#fragment', 'https://staging.example.test\nother']) {
    assert.notEqual(run(target).status, 0, target);
  }
});
test('fails closed when either host list is missing', () => {
  assert.notEqual(run('https://staging.example.test', { DAST_ALLOWED_HOSTS: '' }).status, 0);
  assert.notEqual(run('https://staging.example.test', { DAST_PRODUCTION_HOSTS: '' }).status, 0);
});
test('rejects localhost and IP-address targets', () => {
  assert.notEqual(run('https://localhost').status, 0);
  assert.notEqual(run('https://127.0.0.1').status, 0);
});
