import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Short commit id shown on the title screen and in the debug overlay, so a phone
// can confirm it's running the latest deploy. Also versions the offline cache.
function buildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'LOCAL';
  }
}

function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, base) : [path.relative(base, full).replaceAll('\\', '/')];
  });
}

// Service worker for offline play, written at build time with the exact list
// of built files and a cache named after the build, so each deploy gets a
// fresh cache and old ones are deleted.
// - Pages (navigations): network first, so a new deploy shows up straight
//   away; the cached copy when offline.
// - Everything else: cache first (built assets have content hashes in their
//   names, so a cached copy is never stale).
function serviceWorker(version) {
  return {
    name: 'pixel-grind-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...listFiles(path.resolve('public'))]
        .filter((f) => f !== 'sw.js')
        .map((f) => './' + f);
      const assets = JSON.stringify(['./', ...files], null, 2);
      const source = `// Generated at build time by vite.config.js. Do not edit.
const CACHE = 'pixel-grind-${version}';
const ASSETS = ${assets};
// Module scripts load in CORS mode and servers send Vary headers; match on URL.
const MATCH = { ignoreSearch: true, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pixel-grind-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', MATCH)),
    );
    return;
  }
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig(({ command }) => {
  const id = command === 'serve' ? 'DEV' : buildId().toUpperCase();
  return {
    // Relative asset paths so the build works at https://<user>.github.io/<repo>/
    base: './',
    define: {
      __BUILD_ID__: JSON.stringify(id),
    },
    plugins: [serviceWorker(id)],
  };
});
