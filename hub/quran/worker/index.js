// quran Worker (quran.i36o.workers.dev): tanzil's Quran Navigator served from our own address,
// so the i360 page there (sprint 3, under /i360/) can read the verse being shown.
//
//   /php/get-aya.php, /php/search.php  answered here from the lib site (data.js) — tanzil's own
//                                      scripts refuse requests from other sites, and are never called
//   /i360/health                       200 {ok, pageVersion, texts, exegesis} when the data can be
//                                      served, 503 {ok: false, error} when not (the page then shows
//                                      tanzil's official embed instead)
//   anything else                      tanzil.net, passed through unchanged; a redirect to
//                                      tanzil.net is pointed back at this address
//
// The lib site is reached through a service binding (wrangler.jsonc, LIB): a Worker can't fetch
// another workers.dev Worker of the same account over the Internet (Cloudflare error 1042).
// Published by the i360 pre-push hook when a push changes hub/quran/ or a hub/src file it bundles
// (scripts/hub-workers-pattern.sh), or by hand: npm run publish-quran.
import { createStore } from './data.js';
import { LIB, TANZIL_ORIGIN } from '../../src/sites.js';

// One store per Worker instance (texts stay in memory between requests); a new one if the binding
// it was made with is ever replaced.
let store = null, storeLib = null;
function storeFor(env) {
  if (!store || storeLib !== env.LIB) {
    storeLib = env.LIB;
    store = createStore({ libFetch: (path) => env.LIB.fetch(new Request(LIB + path)) });
  }
  return store;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
const failed = (err) => new Response(`i360 quran Worker: ${err.message}`, { status: 503, headers: { 'Cache-Control': 'no-store' } });

async function passThrough(request, url) {
  const upstream = await fetch(new Request(TANZIL_ORIGIN + url.pathname + url.search, request));
  const headers = new Headers(upstream.headers);
  const location = headers.get('Location');
  if (location && location.startsWith(TANZIL_ORIGIN)) headers.set('Location', location.slice(TANZIL_ORIGIN.length) || '/');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const s = storeFor(env);
    if (url.pathname === '/i360/health') {
      try { return json(await s.health()); } catch (err) { return json({ ok: false, error: err.message }, 503); }
    }
    if (request.method === 'POST' && url.pathname === '/php/get-aya.php') {
      try {
        return new Response(await s.getAya(await request.formData()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      } catch (err) { return failed(err); }
    }
    if (request.method === 'POST' && url.pathname === '/php/search.php') {
      try {
        return new Response(await s.search(await request.formData()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } catch (err) { return failed(err); }
    }
    return passThrough(request, url);
  }
};

