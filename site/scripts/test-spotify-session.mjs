import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// Every module instance gets an isolated, in-memory browser. No account,
// credentials, network, or real browser storage is used by these tests.
const source = await readFile(new URL('../dist/spotify-session.js', import.meta.url), 'utf8');
const CLIENT_ID = 'a'.repeat(32);
const CONFIG = {clientId: CLIENT_ID, redirectUri: 'https://records.example/'};
const ATTEMPT_KEY = 'record-room.spotify.pkce.v1';
const TOKENS_KEY = 'record-room.spotify.tokens.v1';
const OriginalSearchParams = URLSearchParams;
let moduleId = 0;

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function response(data, status = 200) {
  return {ok: status >= 200 && status < 300, status, json: async () => structuredClone(data)};
}

function attempt(update = {}) {
  return {state: 's'.repeat(43), verifier: 'v'.repeat(86), createdAt: Date.now(),
    recordId: 'upper-left-01', hash: '#record=upper-left-01', ...CONFIG, ...update};
}

function savedTokens(update = {}) {
  return {clientId: CLIENT_ID, accessToken: 'previous-access', refreshToken: 'previous-refresh',
    expiresAt: Date.now() + 3600000, ...update};
}

function tokenResponse(update = {}) {
  return {access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 3600, ...update};
}

async function browser({url = 'https://records.example/', config = CONFIG, stored = {}, storage,
  token = () => response(tokenResponse()), forbidCodeRead = false} = {}) {
  let current = new URL(url);
  const navigation = [], calls = [], changes = [];
  const win = new EventTarget();
  win.crypto = webcrypto;
  win.sessionStorage = storage || new MemoryStorage(Object.fromEntries(
    Object.entries(stored).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])));
  win.location = Object.fromEntries(['href', 'origin', 'pathname', 'search', 'hash'].map(key => [key, null]));
  for (const key of Object.keys(win.location)) Object.defineProperty(win.location, key, {get: () => current[key]});
  win.location.assign = value => navigation.push(value);
  win.history = {state: {browsing: true}, replaceState(state, unused, value) { current = new URL(value, current); }};
  win.addEventListener('spotify-session-change', () => changes.push(true));
  globalThis.window = win;
  globalThis.URLSearchParams = forbidCodeRead ? class extends OriginalSearchParams {
    get(key) { if (key === 'code') throw new Error('Unrecognized OAuth code was read'); return super.get(key); }
  } : OriginalSearchParams;
  globalThis.fetch = async (value, options = {}) => {
    calls.push({url: String(value), options});
    if (value === '/api/spotify-config') return response(config);
    assert.equal(value, 'https://accounts.spotify.com/api/token', 'Only the Spotify token endpoint is allowed');
    return token(options);
  };
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${++moduleId}`;
  const {spotifySession: session} = await import(moduleUrl);
  await session.ready;
  return {session, win, navigation, calls, changes, storage: win.sessionStorage,
    get url() { return current; }, get tokenCalls() { return calls.filter(call => call.url.includes('/api/token')); }};
}

const tests = [];
function test(name, run) { tests.push({name, run}); }

test('loads runtime config once without caching and returns defensive status copies', async () => {
  const h = await browser();
  await h.session.ready;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.cache, 'no-store');
  assert.deepEqual(h.session.getStatus(), {configured: true, connected: false, error: null, callbackHandled: false});
  h.session.getStatus().connected = true;
  assert.equal(h.session.getStatus().connected, false);
  assert.ok(h.changes.length);
});

test('creates random state/verifier and the matching S256 challenge without secrets', async () => {
  const h = await browser({url: 'https://records.example/#box=upper-left'});
  await h.session.connect({recordId: 'upper-left-01'});
  const saved = JSON.parse(h.storage.getItem(ATTEMPT_KEY));
  const auth = new URL(h.navigation[0]);
  assert.equal(auth.origin + auth.pathname, 'https://accounts.spotify.com/authorize');
  assert.match(saved.verifier, /^[A-Za-z0-9_-]{86}$/);
  assert.match(saved.state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(auth.searchParams.get('state'), saved.state);
  const hash = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(saved.verifier));
  assert.equal(auth.searchParams.get('code_challenge'), Buffer.from(hash).toString('base64url'));
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(auth.searchParams.get('response_type'), 'code');
  assert.equal(auth.searchParams.get('redirect_uri'), CONFIG.redirectUri);
  assert.deepEqual(new Set(auth.searchParams.get('scope').split(' ')), new Set([
    'streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state', 'user-read-playback-state']));
  assert.equal(auth.searchParams.has('client_secret'), false);
  assert.equal(saved.recordId, 'upper-left-01');
  assert.equal(saved.hash, '#box=upper-left');
  await h.session.connect();
  assert.notEqual(JSON.parse(h.storage.getItem(ATTEMPT_KEY)).state, saved.state);
});

test('coalesces simultaneous connection requests into one authorization attempt', async () => {
  const h = await browser();
  await Promise.all([h.session.connect(), h.session.connect()]);
  assert.equal(h.navigation.length, 1);
});

test('moves preview and localhost browsing to the configured origin before PKCE', async () => {
  for (const current of ['https://preview.example/', 'http://localhost:4173/']) {
    const h = await browser({url: `${current}#record=upper-left-01`});
    await h.session.connect({recordId: 'upper-left-01'});
    const destination = new URL(h.navigation[0]);
    assert.equal(destination.origin, 'https://records.example');
    assert.equal(destination.search, '?spotify-connect=1&spotify-record=upper-left-01');
    assert.equal(destination.hash, '#record=upper-left-01');
    assert.equal(h.storage.getItem(ATTEMPT_KEY), null);
    assert.equal(h.tokenCalls.length, 0);
  }
});

test('canonical hop carries only a valid record ID and resumes once on its origin', async () => {
  const h = await browser({url: 'https://records.example/?spotify-connect=1&spotify-record=lower-middle-03a#box=lower-middle'});
  assert.equal(h.navigation.length, 1);
  assert.equal(h.url.search, '');
  assert.equal(h.url.hash, '#box=lower-middle');
  assert.equal(JSON.parse(h.storage.getItem(ATTEMPT_KEY)).recordId, 'lower-middle-03a');
  const rejected = await browser({url: 'https://preview.example/#box=right'});
  await rejected.session.connect({recordId: 'https://evil.example/'});
  assert.equal(new URL(rejected.navigation[0]).searchParams.has('spotify-record'), false);
});

test('exchanges a recognized callback once, cleans OAuth query, and consumes record intent once', async () => {
  const pending = attempt();
  const h = await browser({url: `https://records.example/?keep=1&code=one-time-code&state=${pending.state}`,
    stored: {[ATTEMPT_KEY]: pending}});
  assert.equal(h.tokenCalls.length, 1);
  const {options} = h.tokenCalls[0];
  assert.equal(options.credentials, 'omit');
  assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(options.body.get('grant_type'), 'authorization_code');
  assert.equal(options.body.get('client_id'), CLIENT_ID);
  assert.equal(options.body.get('code_verifier'), pending.verifier);
  assert.equal(options.body.get('redirect_uri'), CONFIG.redirectUri);
  assert.equal(options.body.has('client_secret'), false);
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(h.storage.getItem(ATTEMPT_KEY), null);
  assert.equal(h.url.search, '?keep=1');
  assert.equal(h.url.hash, pending.hash);
  assert.equal(h.session.getStatus().connected, true);
  assert.equal(h.session.getStatus().callbackHandled, true);
  assert.equal(await h.session.getAccessToken(), 'new-access');
  assert.equal(h.session.consumeReturnRecordId(), 'upper-left-01');
  assert.equal(h.session.consumeReturnRecordId(), null);
  await h.session.ready;
  assert.equal(h.tokenCalls.length, 1);
  const reloaded = await browser({url: h.url.href, storage: h.storage});
  assert.equal(reloaded.tokenCalls.length, 0);
  assert.equal(reloaded.session.consumeReturnRecordId(), null);
});

test('rejects unknown, missing, expired, and wrong-origin state before reading the code', async () => {
  for (const options of [
    {stored: {[ATTEMPT_KEY]: attempt()}, state: 'unrecognized'},
    {stored: {}, state: 's'.repeat(43)},
    {stored: {[ATTEMPT_KEY]: attempt({createdAt: Date.now() - 600001})}, state: 's'.repeat(43)},
    {stored: {[ATTEMPT_KEY]: attempt()}, state: ''},
    {stored: {[ATTEMPT_KEY]: attempt()}, state: 's'.repeat(43), origin: 'https://preview.example'}
  ]) {
    const h = await browser({url: `${options.origin || 'https://records.example'}/?code=do-not-read&state=${options.state}#box=right`,
      stored: options.stored, forbidCodeRead: true});
    assert.equal(h.tokenCalls.length, 0);
    assert.equal(h.storage.getItem(ATTEMPT_KEY), null);
    assert.equal(h.url.search, '');
    assert.equal(h.url.hash, '#box=right');
    assert.equal(h.session.getStatus().callbackHandled, true);
    assert.match(h.session.getStatus().error, /verified or has expired/);
    assert.equal(h.session.consumeReturnRecordId(), null);
  }
});

test('denial preserves browsing, cleans callback parameters, and never automatically retries', async () => {
  const pending = attempt();
  const h = await browser({url: `https://records.example/?error=access_denied&error_description=private&state=${pending.state}&spotify-connect=1#box=right`,
    stored: {[ATTEMPT_KEY]: pending}});
  assert.match(h.session.getStatus().error, /canceled/);
  assert.equal(h.url.search, '');
  assert.equal(h.url.hash, '#box=right');
  assert.equal(h.tokenCalls.length, 0);
  assert.equal(h.navigation.length, 0);
  assert.equal(h.session.consumeReturnRecordId(), null);
});

test('unsuccessful exchange never returns an album or exposes upstream data', async () => {
  const pending = attempt();
  const h = await browser({url: `https://records.example/?code=private-code&state=${pending.state}`,
    stored: {[ATTEMPT_KEY]: pending}, token: () => { throw new Error('private-code secret-refresh private-upstream-detail'); }});
  assert.equal(h.session.getStatus().connected, false);
  assert.match(h.session.getStatus().error, /sign-in could not finish/);
  assert.doesNotMatch(h.session.getStatus().error, /private|secret/);
  assert.equal(h.session.consumeReturnRecordId(), null);
  assert.equal(h.storage.getItem(ATTEMPT_KEY), null);
});

test('successful OAuth validates stored record intent before exposing it', async () => {
  const pending = attempt({recordId: '//evil.example/?redirect=1'});
  const h = await browser({url: `https://records.example/?code=ok&state=${pending.state}`, stored: {[ATTEMPT_KEY]: pending}});
  assert.equal(h.session.getStatus().connected, true);
  assert.equal(h.session.consumeReturnRecordId(), null);
  assert.equal(h.navigation.length, 0);
});

test('expired tokens refresh once for concurrent callers and retain the existing refresh token', async () => {
  let release;
  const upstream = new Promise(resolve => { release = resolve; });
  const h = await browser({stored: {[TOKENS_KEY]: savedTokens({expiresAt: Date.now() - 1000})}, token: () => upstream});
  const first = h.session.getAccessToken(), second = h.session.getAccessToken();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.tokenCalls.length, 1);
  release(response(tokenResponse({refresh_token: undefined})));
  assert.deepEqual(await Promise.all([first, second]), ['new-access', 'new-access']);
  assert.equal(h.tokenCalls[0].options.body.get('grant_type'), 'refresh_token');
  assert.equal(h.tokenCalls[0].options.body.get('refresh_token'), 'previous-refresh');
  assert.equal(h.tokenCalls[0].options.body.get('client_id'), CLIENT_ID);
  assert.equal(JSON.parse(h.storage.getItem(TOKENS_KEY)).refreshToken, 'previous-refresh');
  assert.equal(await h.session.getAccessToken(), 'new-access');
  assert.equal(h.tokenCalls.length, 1);
});

test('forced refresh replaces a still-valid token and serializes simultaneous retry requests', async () => {
  const h = await browser({stored: {[TOKENS_KEY]: savedTokens()}});
  assert.equal(await h.session.getAccessToken(), 'previous-access');
  assert.deepEqual(await Promise.all([h.session.getAccessToken({forceRefresh: true}),
    h.session.getAccessToken({forceRefresh: true})]), ['new-access', 'new-access']);
  assert.equal(h.tokenCalls.length, 1);
  assert.equal(JSON.parse(h.storage.getItem(TOKENS_KEY)).refreshToken, 'new-refresh');
});

test('failed refresh removes unusable tokens and surfaces only a sanitized reconnect error', async () => {
  const h = await browser({stored: {[TOKENS_KEY]: savedTokens({expiresAt: 1})},
    token: () => response({error: 'private previous-access previous-refresh'}, 400)});
  await assert.rejects(h.session.getAccessToken(), error => {
    assert.match(error.message, /connection expired/);
    assert.doesNotMatch(error.message, /private|previous-access|previous-refresh/);
    return true;
  });
  assert.equal(h.session.getStatus().connected, false);
  assert.equal(h.storage.getItem(TOKENS_KEY), null);
  assert.equal(h.navigation.length, 0);
});

test('disconnect clears only this app storage and prevents in-flight refresh from reviving tokens', async () => {
  let release;
  const upstream = new Promise(resolve => { release = resolve; });
  const h = await browser({stored: {[TOKENS_KEY]: savedTokens({expiresAt: 1}),
    [ATTEMPT_KEY]: attempt(), unrelated: 'keep me'}, token: () => upstream});
  const refreshing = h.session.getAccessToken();
  await new Promise(resolve => setTimeout(resolve, 0));
  h.session.disconnect();
  release(response(tokenResponse()));
  await assert.rejects(refreshing, /connection expired/);
  assert.equal(h.storage.getItem(TOKENS_KEY), null);
  assert.equal(h.storage.getItem(ATTEMPT_KEY), null);
  assert.equal(h.storage.getItem('unrelated'), 'keep me');
  assert.equal(h.session.getStatus().connected, false);
  assert.equal(h.session.getStatus().error, null);
});

test('rejects unsafe/non-root redirects and unconfigured sessions without any authorization navigation', async () => {
  for (const redirectUri of ['http://records.example/', 'http://localhost:4173/', 'https://records.example/callback',
    'https://records.example/?redirect=1', 'https://records.example/#hash', 'https://records.example/?',
    'https://records.example/#', 'https://user:password@records.example/']) {
    const h = await browser({config: {...CONFIG, redirectUri}});
    assert.equal(h.session.getStatus().configured, false);
    await assert.rejects(h.session.connect(), /not configured/);
    assert.equal(h.navigation.length, 0);
  }
});

test('accepts explicit IPv4/IPv6 HTTP loopback and canonicalizes localhost before authorization', async () => {
  for (const redirectUri of ['http://127.0.0.1:4173/', 'http://[::1]:4173/']) {
    const h = await browser({url: 'http://localhost:4173/#box=right', config: {...CONFIG, redirectUri}});
    assert.equal(h.session.getStatus().configured, true);
    await h.session.connect();
    assert.equal(new URL(h.navigation[0]).origin, new URL(redirectUri).origin);
    assert.equal(h.storage.getItem(ATTEMPT_KEY), null);
  }
});

test('disabled storage fails connection clearly before leaving the page', async () => {
  const storage = new MemoryStorage();
  storage.setItem = () => { throw new Error('browser-specific private detail'); };
  const h = await browser({storage});
  await assert.rejects(h.session.connect(), /needs session storage/);
  assert.match(h.session.getStatus().error, /needs session storage/);
  assert.equal(h.navigation.length, 0);
});

test('saved tokens from another client or expired tokens without refresh cannot connect the session', async () => {
  for (const saved of [savedTokens({clientId: 'b'.repeat(32)}), savedTokens({expiresAt: 1, refreshToken: null})]) {
    const h = await browser({stored: {[TOKENS_KEY]: saved}});
    assert.equal(h.session.getStatus().connected, false);
    assert.equal(h.storage.getItem(TOKENS_KEY), null);
    await assert.rejects(h.session.getAccessToken(), /Connect Spotify/);
  }
});

try {
  for (const {name, run} of tests) {
    await run();
    console.log(`✓ ${name}`);
  }
  console.log(`${tests.length} Spotify session tests passed.`);
} finally {
  globalThis.URLSearchParams = OriginalSearchParams;
}
