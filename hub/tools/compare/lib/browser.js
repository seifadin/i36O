// The browser side: Playwright's Chromium, and the network every comparison sees.
// Pages are served at their real addresses (https://i36o.web.app/…, the theme site…) from
// local folders, so they run exactly as published; anything not listed is cut off, so no
// comparison ever depends on, or reaches, an outside service.
// Playwright is not one of the repo's packages (README): it is found where it is installed.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  try { playwright = require(join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright')); } catch {
    console.error('Playwright is not installed (see hub/tools/compare/README.md).');
    process.exit(2);
  }
}
export const { chromium } = playwright;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.gz': 'application/octet-stream'
};

// Answers a request with a local file (a folder → its index.html), or 404.
export function serveFile(route, file) {
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file, headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
}

export const serveJson = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

// hosts: { 'i36o.web.app': '/a/folder', 'api.example': (route, url) => … }. Everything else is aborted.
export async function network(ctx, hosts) {
  ctx.setDefaultTimeout(5000);   // a missing button fails its step quickly instead of after 30 s
  await ctx.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const h = hosts[url.hostname];
    if (typeof h === 'function') return h(route, url);
    if (typeof h === 'string') return serveFile(route, join(h, decodeURIComponent(url.pathname)));
    return route.abort();
  });
}

// The hosts every hub page needs: the pages themselves and the theme site.
export const hubHosts = (v) => ({ 'i36o.web.app': v.public, 'theme.i36o.workers.dev': v.theme });

// One browser for a whole run; contexts are opened per case.
export const launch = () => chromium.launch();

// Collects uncaught page errors (part of every result: a new error is a difference).
export function errorsOf(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).split('\n')[0]));
  return errors;
}
