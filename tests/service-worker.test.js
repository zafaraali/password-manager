import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker({ fetch, cache } = {}) {
  const handlers = {};
  vm.runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://vault.test' }, addEventListener: (type, fn) => { handlers[type] = fn; } },
    fetch: fetch || (async () => { throw new Error('offline'); }),
    caches: { open: async () => cache }
  });
  return handlers;
}
const request = (url, overrides = {}) => ({ url, method: 'GET', mode: 'cors', cache: 'default', ...overrides });

test('service worker never caches breach requests, other external URLs or no-store requests', () => {
  const handlers = worker();
  const urls = ['https://api.pwnedpasswords.com/range/12345', 'https://fonts.googleapis.com/test.css'];
  for (const url of urls) handlers.fetch({ request: request(url), respondWith: () => assert.fail('External request intercepted') });
  handlers.fetch({ request: request('https://vault.test/file.json', { cache: 'no-store' }), respondWith: () => assert.fail('no-store request intercepted') });
});

test('service worker uses fresh app responses and survives cache quota failure', async () => {
  const response = { ok: true, clone() { return this; } };
  const handlers = worker({ fetch: async () => response, cache: { put: async () => { throw new Error('Quota'); }, match: async () => 'stale' } });
  let result;
  handlers.fetch({ request: request('https://vault.test/app.js'), respondWith: value => { result = value; } });
  assert.equal(await result, response);
});

test('service worker serves cached app assets when offline', async () => {
  const handlers = worker({ cache: { match: async () => 'cached app' } });
  let result;
  handlers.fetch({ request: request('https://vault.test/', { mode: 'navigate' }), respondWith: value => { result = value; } });
  assert.equal(await result, 'cached app');
});
