import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getSpotifyConfig, spotifyConfigResponse} from '../api/spotify-config.js';

const clientId = '0123456789abcdef0123456789abcdef';
const environment = {SPOTIFY_CLIENT_ID: clientId, SPOTIFY_REDIRECT_URI: 'https://records.example.test/', SPOTIFY_CLIENT_SECRET: 'must-never-be-returned'};
assert.deepEqual(getSpotifyConfig(environment), {clientId, redirectUri: environment.SPOTIFY_REDIRECT_URI});
for (const redirectUri of ['http://127.0.0.1:4173/', 'http://[::1]:4173/', 'https://records.example.test']) {
  assert(getSpotifyConfig({...environment, SPOTIFY_REDIRECT_URI: redirectUri}), `Expected a root redirect: ${redirectUri}`);
}
for (const redirectUri of ['', 'http://localhost:4173/', 'http://records.example.test/', 'https://records.example.test/callback', 'https://records.example.test/?code=x', 'https://records.example.test/#', 'https://records.example.test/?', 'https://user:pass@records.example.test/', 'https://@records.example.test/', 'https://records.example.test/../', 'https://records.example.test:99999/', 'https://127.999.0.1/', 'https://%/', ' https://records.example.test/', 'https://records.example.test/\n', 'javascript:alert(1)']) {
  assert.equal(getSpotifyConfig({...environment, SPOTIFY_REDIRECT_URI: redirectUri}), null, `Unexpected redirect: ${redirectUri}`);
}
for (const value of [undefined, '', 'invalid', `${clientId}x`, ` ${clientId}`, `${clientId}\n`]) assert.equal(getSpotifyConfig({...environment, SPOTIFY_CLIENT_ID: value}), null);
assert.equal(getSpotifyConfig({SPOTIFY_CLIENT_ID: clientId}), null, 'Production must explicitly configure its redirect');
for (const method of ['GET', 'HEAD']) {
  const result = spotifyConfigResponse(method, environment);
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(result.headers['Content-Type'], /^application\/json/);
  assert.deepEqual(JSON.parse(result.body), {clientId, redirectUri: environment.SPOTIFY_REDIRECT_URI});
  assert(!result.body.includes(environment.SPOTIFY_CLIENT_SECRET));
}
const unavailable = spotifyConfigResponse('GET', {});
assert.equal(unavailable.status, 503);
assert.deepEqual(Object.keys(JSON.parse(unavailable.body)), ['error']);
for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
  const result = spotifyConfigResponse(method, environment);
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'GET, HEAD');
  assert(!result.body.includes(clientId));
}

// Importing the Python module does not load the real .env.local file. The
// server runs on an ephemeral port with synthetic settings and a temporary root.
const python = String.raw`
import http.client
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
from functools import partial

spec = importlib.util.spec_from_file_location("collection_server", "scripts/serve.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
client_id = "0123456789abcdef0123456789abcdef"
settings = {"SPOTIFY_CLIENT_ID": client_id}
assert module.spotify_config(settings) == {"clientId": client_id, "redirectUri": module.LOCAL_REDIRECT_URI}
assert module.spotify_config({}) is None
for uri in ["https://records.example.test/", "http://127.0.0.1:4173/", "http://[::1]:4173/"]:
    assert module.valid_redirect_uri(uri), uri
for uri in ["http://localhost:4173/", "http://records.example.test/", "https://records.example.test/callback", "https://records.example.test/?", "https://records.example.test/#", "https://user:pass@records.example.test/", "https://@records.example.test/", "https://records.example.test/../", "https://records.example.test:99999/", "https://127.999.0.1/", "http://127.999.0.1/", "https://%/"]:
    assert not module.valid_redirect_uri(uri), uri
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    dotenv = root / "test.env"
    dotenv.write_text('SPOTIFY_CLIENT_ID="' + client_id + '"\nSPOTIFY_REDIRECT_URI=\'http://127.0.0.1:4173/\' # local\nexport PRESERVE=replacement\nQUOTED="hash#kept"\n')
    loaded = {"PRESERVE": "inherited"}
    module.load_dotenv(dotenv, loaded)
    assert loaded == {"SPOTIFY_CLIENT_ID": client_id, "SPOTIFY_REDIRECT_URI": module.LOCAL_REDIRECT_URI, "PRESERVE": "inherited", "QUOTED": "hash#kept"}
    public = root / "dist"
    public.mkdir()
    (public / "index.html").write_text("collection index")
    (public / "link").symlink_to(dotenv)
    os.environ.clear()
    os.environ.update(settings)
    os.environ["SPOTIFY_CLIENT_SECRET"] = "must-never-be-returned"
    class QuietHandler(module.CollectionHandler):
        def log_message(self, *args):
            pass
    server = module.ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(public)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    def request(method, path):
        connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
        connection.request(method, path)
        response = connection.getresponse()
        result = (response.status, dict(response.getheaders()), response.read())
        connection.close()
        return result
    try:
        status, headers, body = request("GET", "/api/spotify-config?SPOTIFY_CLIENT_SECRET=ignored")
        assert status == 200
        assert headers["Cache-Control"] == "no-store"
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert json.loads(body) == module.spotify_config(settings)
        assert b"must-never-be-returned" not in body
        assert request("HEAD", "/api/spotify-config")[2] == b""
        assert request("POST", "/api/spotify-config")[0] == 405
        assert request("GET", "/")[2] == b"collection index"
        for path in ["/.env.local", "/../test.env", "/%2e%2e/test.env", "/%2e%2e%2ftest.env", "/link", "/scripts/serve.py", "/api/spotify-config.js"]:
            assert request("GET", path)[0] == 404, path
        os.environ.pop("SPOTIFY_CLIENT_ID")
        assert request("GET", "/api/spotify-config")[0] == 503
    finally:
        server.shutdown()
        server.server_close()
        worker.join()
print("Validated Python config, dotenv precedence, and dist-only HTTP serving.")
`;
const result = spawnSync('python3', ['-c', python], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  encoding: 'utf8',
  env: {PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: '1'},
});
assert.equal(result.status, 0, result.stderr || result.error?.message);
process.stdout.write(result.stdout);
console.log('Validated public Spotify configuration, HTTP methods, and no-secret responses.');
