#!/usr/bin/env python3
"""Preview the live status page with the local assets/ (theme, script, icons).

Usage: ./preview.py [port]   then open http://localhost:8088/

Files that exist under assets/ are served from disk; everything else is fetched from
https://status.quividi.com, with that origin rewritten to localhost so the page keeps
loading the local copies. The status data itself (summary.json) is always the live one.
"""

import functools
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LIVE = "https://status.quividi.com"
ASSETS = Path(__file__).resolve().parent / "assets"
TEXT_TYPES = (
    "text/",
    "application/javascript",
    "application/json",
    "application/manifest+json",
)


class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        if Path(self.translate_path(self.path)).is_file():
            super().do_GET()
        elif self.path.split("?", 1)[0].endswith("service-worker.js"):
            self.send_error(404, "no service worker in preview")
        else:
            self.proxy()

    def proxy(self):
        if not self.path.startswith("/"):
            self.send_error(400)
            return
        try:
            r = urllib.request.urlopen(LIVE + self.path, timeout=15)
        except urllib.error.HTTPError as e:
            r = e
        except (urllib.error.URLError, TimeoutError) as e:
            self.send_error(502, f"{LIVE} unreachable: {e}")
            return
        with r:
            body, ctype, status = r.read(), r.headers.get("Content-Type", ""), r.status
        if ctype.startswith(TEXT_TYPES):
            origin = f"http://{self.headers.get('Host', f'localhost:{self.server.server_port}')}"
            body = body.replace(LIVE.encode(), origin.encode())
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8088
    handler = functools.partial(Preview, directory=str(ASSETS))
    print(f"Preview on http://localhost:{port}/ (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
