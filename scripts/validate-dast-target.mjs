#!/usr/bin/env node
import { isIP } from 'node:net';

const rawTarget = process.argv[2] ?? '';
const allowedHosts = (process.env.DAST_ALLOWED_HOSTS ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
const productionHosts = (process.env.DAST_PRODUCTION_HOSTS ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
function fail(message) { console.error('DAST target rejected: ' + message); process.exit(1); }

if (!rawTarget) fail('provide an explicit staging URL.');
if (/[\r\n]/.test(rawTarget)) fail('newlines are not permitted in the target.');
if (allowedHosts.length === 0) fail('configure the DAST_ALLOWED_HOSTS repository variable.');
let target;
try { target = new URL(rawTarget); } catch { fail('the target must be a valid absolute URL.'); }
const hostname = target.hostname.toLowerCase();
if (target.protocol !== 'https:') fail('only HTTPS targets are permitted.');
if (target.username || target.password) fail('URLs containing credentials are not permitted.');
if (target.search || target.hash) fail('query strings and fragments are not permitted.');
if (hostname === 'localhost' || hostname.endsWith('.localhost') || isIP(hostname)) fail('localhost and IP-address targets are not permitted.');
if (productionHosts.includes(hostname)) fail('the target matches a configured production hostname.');
if (!allowedHosts.includes(hostname)) fail('hostname "' + hostname + '" is not an exact member of DAST_ALLOWED_HOSTS.');
console.log('Validated staging DAST target: https://' + hostname + target.pathname);
