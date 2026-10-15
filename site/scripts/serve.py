#!/usr/bin/env python3
"""Serve the collection and its public Spotify configuration without dependencies."""

from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
from pathlib import Path
import re
import shlex
from urllib.parse import unquote, urlsplit


SITE_ROOT = Path(__file__).resolve().parents[1]
DIST_ROOT = SITE_ROOT / "dist"
LOCAL_REDIRECT_URI = "http://127.0.0.1:4173/"
CLIENT_ID = re.compile(r"[a-fA-F0-9]{32}\Z")
ROOT_URL = re.compile(r"https?://([^/?#]+)/?\Z")
LOOPBACK_AUTHORITY = re.compile(r"(?:127(?:\.(?:0|[1-9]\d{0,2})){3}|\[::1\])(?::\d+)?\Z")


def load_dotenv(path, environment=None):
    """Load a local KEY=value file; inherited environment variables take priority."""
    environment = os.environ if environment is None else environment
    if not path.is_file():
        return
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, separator, value = line.partition("=")
        name = name.strip()
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            raise ValueError(f"Invalid environment assignment at line {line_number}.")
        try:
            # shlex accepts single/double quotes and comments without expanding
            # variables or executing commands. These settings need one line each.
            parts = shlex.split(value, comments=True, posix=True)
        except ValueError:
            raise ValueError(f"Invalid environment quoting at line {line_number}.") from None
        environment.setdefault(name, " ".join(parts))


def valid_redirect_uri(value):
    if not isinstance(value, str):
        return False
    match = ROOT_URL.fullmatch(value)
    if not match or re.search(r"[\s\\@]", match[1]):
        return False
    try:
        url = urlsplit(value)
        # Accessing port validates its numeric range, including HTTPS values.
        url.port
        if not url.hostname or url.username or url.password or url.path not in ("", "/") or url.query or url.fragment:
            return False
        hostname = url.hostname
        if ":" in hostname:
            ipaddress.IPv6Address(hostname)
        elif hostname.rsplit(".", 1)[-1].isdigit():
            ipaddress.IPv4Address(hostname)
        else:
            hostname = hostname.encode("idna").decode("ascii")
            labels = (hostname[:-1] if hostname.endswith(".") else hostname).split(".")
            if len(hostname) > 253 or not all(re.fullmatch(r"[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?", label) for label in labels):
                return False
        if url.scheme == "https":
            return True
        if url.scheme != "http" or not LOOPBACK_AUTHORITY.fullmatch(match[1]):
            return False
        return url.hostname == "::1" or all(int(part) <= 255 for part in url.hostname.split("."))
    except (ValueError, UnicodeError):
        return False


def spotify_config(environment=None):
    environment = os.environ if environment is None else environment
    client_id = environment.get("SPOTIFY_CLIENT_ID", "")
    redirect_uri = environment.get("SPOTIFY_REDIRECT_URI", LOCAL_REDIRECT_URI)
    if not isinstance(client_id, str) or not CLIENT_ID.fullmatch(client_id) or not valid_redirect_uri(redirect_uri):
        return None
    return {"clientId": client_id, "redirectUri": redirect_uri}


class CollectionHandler(SimpleHTTPRequestHandler):
    def is_config_request(self):
        return urlsplit(self.path).path == "/api/spotify-config"

    def send_config(self, head=False):
        configuration = spotify_config()
        status = HTTPStatus.OK if configuration else HTTPStatus.SERVICE_UNAVAILABLE
        self.send_json(status, configuration or {"error": "Spotify configuration is unavailable."}, head=head)

    def send_json(self, status, data, head=False, allow=None):
        body = json.dumps(data, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        if allow:
            self.send_header("Allow", allow)
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def do_GET(self):
        if self.is_config_request():
            self.send_config()
        else:
            super().do_GET()

    def do_HEAD(self):
        if self.is_config_request():
            self.send_config(head=True)
        else:
            super().do_HEAD()

    def unsupported_method(self):
        if self.is_config_request():
            self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "Method not allowed."}, allow="GET, HEAD")
        else:
            self.send_error(HTTPStatus.NOT_IMPLEMENTED)

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_TRACE = do_CONNECT = unsupported_method

    def send_head(self):
        # Only dist is public, including after URL decoding and symlink resolution.
        path = unquote(urlsplit(self.path).path)
        candidate = Path(self.translate_path(self.path)).resolve()
        root = Path(self.directory).resolve()
        if any(part == ".." or part.startswith(".") for part in path.split("/")) or not candidate.is_relative_to(root):
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def log_request(self, code="-", size="-"):
        # OAuth callbacks carry a short-lived code in their query string.
        self.log_message('%s %s %s', self.command, urlsplit(self.path).path, str(code))


def main():
    try:
        load_dotenv(SITE_ROOT / ".env.local")
    except ValueError as error:
        raise SystemExit(str(error)) from None
    handler = partial(CollectionHandler, directory=str(DIST_ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 4173), handler) as server:
        print("Record collection: http://127.0.0.1:4173/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
