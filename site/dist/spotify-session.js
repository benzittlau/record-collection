// Spotify's public-client PKCE flow. Configuration comes from the server; a
// client secret never belongs in this module or in a browser request.
const ATTEMPT_KEY = 'record-room.spotify.pkce.v1';
const TOKENS_KEY = 'record-room.spotify.tokens.v1';
const ATTEMPT_LIFETIME = 10 * 60 * 1000;
const TOKEN_MARGIN = 30 * 1000;
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
const RECORD_ID = /^[a-z]+(?:-[a-z]+)*-\d+[a-z]?$/;
const OAUTH_PARAMS = ['code', 'state', 'error', 'error_description'];
const INTENT_PARAMS = ['spotify-connect', 'spotify-record'];
const STORAGE_ERROR = 'Spotify needs session storage in this tab. Allow site storage and try connecting again.';
const RECONNECT_ERROR = 'Your Spotify connection expired. Connect Spotify again to continue.';

let config = null, tokens = null, returnRecordId = null;
let refreshPromise = null, connectPromise = null, revision = 0;
let status = {configured: false, connected: false, error: null, callbackHandled: false};

function setStatus(update) {
  const next = {...status, ...update};
  if (Object.keys(next).every(key => next[key] === status[key])) return;
  status = next;
  window.dispatchEvent(new Event('spotify-session-change'));
}

function readStored(key) {
  try { return JSON.parse(window.sessionStorage.getItem(key)); }
  catch { return null; }
}

function removeStored(key) {
  try { window.sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

function writeStored(key, value) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); }
  catch { throw new Error(STORAGE_ERROR); }
}

function validRecordId(value) {
  return typeof value === 'string' && value.length <= 100 && RECORD_ID.test(value) ? value : null;
}

function validConfig(value) {
  if (!value || typeof value.clientId !== 'string' || !/^[a-fA-F0-9]{32}$/.test(value.clientId)) return null;
  if (typeof value.redirectUri !== 'string' || /[?#]/.test(value.redirectUri)) return null;
  try {
    const url = new URL(value.redirectUri);
    const loopback = /^127(?:\.\d{1,3}){3}$/.test(url.hostname) || url.hostname === '[::1]';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return {clientId: value.clientId, redirectUri: value.redirectUri, origin: url.origin};
  } catch { return null; }
}

function validToken(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 8192;
}

function readTokens() {
  const saved = readStored(TOKENS_KEY);
  if (saved && saved.clientId === config.clientId && validToken(saved.accessToken) &&
      Number.isFinite(saved.expiresAt) && (saved.expiresAt > Date.now() || validToken(saved.refreshToken))) {
    return {accessToken: saved.accessToken, refreshToken: validToken(saved.refreshToken) ? saved.refreshToken : null,
      expiresAt: saved.expiresAt, clientId: saved.clientId};
  }
  removeStored(TOKENS_KEY);
  return null;
}

function validAttempt(attempt) {
  return attempt && /^[A-Za-z0-9_-]{43}$/.test(attempt.state) &&
    /^[A-Za-z0-9_-]{86}$/.test(attempt.verifier) && Number.isFinite(attempt.createdAt) &&
    attempt.createdAt <= Date.now() && Date.now() - attempt.createdAt < ATTEMPT_LIFETIME &&
    attempt.clientId === config.clientId && attempt.redirectUri === config.redirectUri &&
    window.location.origin === config.origin && window.location.pathname === '/';
}

function cleanUrl(params, restoredHash = null) {
  const url = new URL(window.location.href);
  for (const key of params) url.searchParams.delete(key);
  if (!url.hash && restoredHash && typeof restoredHash === 'string' && restoredHash.startsWith('#')) url.hash = restoredHash;
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {...options, cache: 'no-store', signal: controller.signal});
    if (!response.ok) throw new Error('request failed');
    return await response.json();
  } finally { clearTimeout(timeout); }
}

async function requestTokens(params, oldRefreshToken = null) {
  const result = await requestJson('https://accounts.spotify.com/api/token', {
    method: 'POST', credentials: 'omit', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: config.clientId, ...params})
  });
  if (!validToken(result.access_token) || String(result.token_type).toLowerCase() !== 'bearer' ||
      !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw new Error('invalid token response');
  return {accessToken: result.access_token,
    refreshToken: validToken(result.refresh_token) ? result.refresh_token : oldRefreshToken,
    expiresAt: Date.now() + result.expires_in * 1000, clientId: config.clientId};
}

function saveTokens(next) {
  writeStored(TOKENS_KEY, next);
  tokens = next;
  setStatus({connected: true, error: null});
}

async function handleCallback(params) {
  const attempt = readStored(ATTEMPT_KEY);
  const returnedState = params.get('state');
  // Consume the attempt and URL before any asynchronous work. A reload or a
  // second initialization cannot exchange the same authorization code again.
  removeStored(ATTEMPT_KEY);
  const recognized = validAttempt(attempt) && returnedState === attempt.state;
  cleanUrl([...OAUTH_PARAMS, ...INTENT_PARAMS], recognized ? attempt.hash : null);
  setStatus({callbackHandled: true});
  if (!recognized) {
    setStatus({error: 'Spotify sign-in could not be verified or has expired. Please connect Spotify again.'});
    return;
  }
  if (params.has('error')) {
    setStatus({error: params.get('error') === 'access_denied'
      ? 'Spotify connection was canceled. You can keep browsing or connect again when you are ready.'
      : 'Spotify could not complete sign-in. Please try connecting again.'});
    return;
  }
  // Do not read or exchange a code until its state and origin are recognized.
  const code = params.get('code');
  if (!code || code.length > 8192) {
    setStatus({error: 'Spotify did not return a valid sign-in code. Please connect again.'});
    return;
  }
  const ticket = revision;
  try {
    const next = await requestTokens({grant_type: 'authorization_code', code,
      redirect_uri: attempt.redirectUri, code_verifier: attempt.verifier});
    if (ticket !== revision) return;
    saveTokens(next);
    returnRecordId = validRecordId(attempt.recordId);
  } catch {
    if (ticket === revision) setStatus({error: 'Spotify sign-in could not finish. Please connect Spotify again.'});
  }
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function startConnect({recordId} = {}) {
  if (!config) throw new Error(status.error || 'Spotify connection is not configured for this room.');
  const selected = validRecordId(recordId);
  returnRecordId = null;
  setStatus({error: null});
  if (window.location.origin !== config.origin) {
    // Session storage belongs to an origin. Move to the registered origin
    // before creating the verifier, including localhost -> 127.0.0.1 hops.
    const canonical = new URL(config.redirectUri);
    canonical.searchParams.set('spotify-connect', '1');
    if (selected) canonical.searchParams.set('spotify-record', selected);
    canonical.hash = window.location.hash;
    window.location.assign(canonical.href);
    return;
  }
  const ticket = revision;
  try {
    if (!window.crypto?.getRandomValues || !window.crypto?.subtle) throw new Error('secure browser required');
    const verifier = base64url(window.crypto.getRandomValues(new Uint8Array(64)));
    const state = base64url(window.crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    if (ticket !== revision) return;
    writeStored(ATTEMPT_KEY, {state, verifier, createdAt: Date.now(), recordId: selected,
      hash: window.location.hash, clientId: config.clientId, redirectUri: config.redirectUri});
    const authorize = new URL('https://accounts.spotify.com/authorize');
    authorize.search = new URLSearchParams({client_id: config.clientId, response_type: 'code',
      redirect_uri: config.redirectUri, scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge});
    window.location.assign(authorize.href);
  } catch (error) {
    removeStored(ATTEMPT_KEY);
    const message = error?.message === STORAGE_ERROR ? STORAGE_ERROR
      : 'Spotify could not open sign-in. Use a secure browser connection and try again.';
    setStatus({error: message});
    throw new Error(message);
  }
}

async function initialize() {
  const params = new URLSearchParams(window.location.search);
  const callback = params.has('code') || params.has('error');
  try { config = validConfig(await requestJson('/api/spotify-config')); } catch { /* A static host can still browse and use embeds. */ }
  if (!config) {
    if (callback) cleanUrl([...OAUTH_PARAMS, ...INTENT_PARAMS]);
    else if (params.has('spotify-connect')) cleanUrl(INTENT_PARAMS);
    removeStored(ATTEMPT_KEY);
    setStatus({callbackHandled: callback, error: 'Spotify connection is not configured for this room.'});
    return;
  }
  tokens = readTokens();
  setStatus({configured: true, connected: !!tokens});
  if (callback) { await handleCallback(params); return; }
  const pending = readStored(ATTEMPT_KEY);
  if (pending && !validAttempt(pending)) removeStored(ATTEMPT_KEY);
  if (params.get('spotify-connect') === '1') {
    const recordId = validRecordId(params.get('spotify-record'));
    // Remove the hop intent before starting OAuth so Back/reload cannot loop.
    cleanUrl(INTENT_PARAMS);
    try { await startConnect({recordId}); } catch { /* The status is ready for the UI. */ }
  }
}

function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const ticket = revision, previous = tokens;
  refreshPromise = (async () => {
    try {
      if (!previous?.refreshToken) throw new Error('no refresh token');
      const next = await requestTokens({grant_type: 'refresh_token', refresh_token: previous.refreshToken}, previous.refreshToken);
      if (ticket !== revision) throw new Error('session changed');
      saveTokens(next);
      return next.accessToken;
    } catch {
      if (ticket === revision) {
        tokens = null;
        removeStored(TOKENS_KEY);
        setStatus({connected: false, error: RECONNECT_ERROR});
      }
      throw new Error(RECONNECT_ERROR);
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

const ready = initialize();

export const spotifySession = {
  ready,
  getStatus() { return {...status}; },
  connect(options = {}) {
    if (!connectPromise) connectPromise = ready.then(() => startConnect(options)).finally(() => { connectPromise = null; });
    return connectPromise;
  },
  disconnect() {
    revision++;
    tokens = null;
    returnRecordId = null;
    removeStored(TOKENS_KEY);
    removeStored(ATTEMPT_KEY);
    setStatus({connected: false, error: null});
  },
  async getAccessToken({forceRefresh = false} = {}) {
    await ready;
    if (!tokens) throw new Error(status.error || 'Connect Spotify to play full albums in this room.');
    if (!forceRefresh && tokens.expiresAt > Date.now() + TOKEN_MARGIN) return tokens.accessToken;
    return refreshAccessToken();
  },
  consumeReturnRecordId() {
    const result = returnRecordId;
    returnRecordId = null;
    return result;
  }
};
