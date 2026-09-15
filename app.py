"""Klyze.gg lokal sunucu (tasarım aşaması, backend sonra).

Kullanim:
    python app.py            # http://127.0.0.1:8000
    python app.py --port 8080
"""
import argparse
import functools
import http.server
import os

HERE = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    handler = functools.partial(NoCacheHandler, directory=HERE)
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        print(f"Klyze site yayinda: http://{args.host}:{args.port}")
        print("Durdurmak icin: Ctrl+C")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
