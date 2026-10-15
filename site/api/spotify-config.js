const CLIENT_ID = /^[a-f0-9]{32}$/i;
const ROOT_URL = /^https?:\/\/([^/?#]+)\/?$/;
const LOOPBACK_AUTHORITY = /^(?:127(?:\.(?:0|[1-9]\d{0,2})){3}|\[::1\])(?::\d+)?$/;

function validRedirectUri(value) {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  const match = value.match(ROOT_URL);
  if (!match || /[\s\\@]/.test(match[1])) return false;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return false;
    return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_AUTHORITY.test(match[1]));
  } catch {
    return false;
  }
}

export function getSpotifyConfig(environment) {
  const clientId = environment.SPOTIFY_CLIENT_ID;
  const redirectUri = environment.SPOTIFY_REDIRECT_URI;
  if (typeof clientId !== 'string' || clientId.length !== 32 || !CLIENT_ID.test(clientId) || !validRedirectUri(redirectUri)) return null;
  return {clientId, redirectUri};
}

export function spotifyConfigResponse(method, environment) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  };
  if (method !== 'GET' && method !== 'HEAD') {
    return {status: 405, headers: {...headers, Allow: 'GET, HEAD'}, body: JSON.stringify({error: 'Method not allowed.'})};
  }
  const configuration = getSpotifyConfig(environment);
  return {
    status: configuration ? 200 : 503,
    headers,
    body: JSON.stringify(configuration || {error: 'Spotify configuration is unavailable.'}),
  };
}

export default function handler(request, response) {
  const result = spotifyConfigResponse(request.method, process.env);
  response.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  response.setHeader('Content-Length', Buffer.byteLength(result.body));
  response.end(request.method === 'HEAD' ? undefined : result.body);
}
