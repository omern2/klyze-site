"""Klyze.gg lokal sunucu (tasarım aşaması, backend sonra).

Kullanim:
    python app.py            # http://127.0.0.1:8000
    python app.py --port 8080

/indir yolu, Vercel'deki api/indir.js ile ayni isi yapar:
veritabanina "yayindaki son surum ne?" diye sorar, sha256 gecerliyse
302 ile dosyaya yonlendirir. Boylece yerelde de "Windows icin indir"
dugmesi gercek dosyaya gider.
"""
import argparse
import functools
import http.server
import json
import os
import re
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co"
PUBLISHABLE = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi"
HASH_KURALI = re.compile(r"^[0-9a-f]{64}$")


def son_surum(zaman_asimi=8):
    """site.son_surum() RPC'sini cagirir; yayindaki son surumu dondurur."""
    istek = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/rpc/son_surum",
        data=b"{}",
        method="POST",
        headers={
            "apikey": PUBLISHABLE,
            "Authorization": "Bearer " + PUBLISHABLE,
            "Content-Type": "application/json",
            "Accept-Profile": "site",
            "Content-Profile": "site",
        },
    )
    with urllib.request.urlopen(istek, timeout=zaman_asimi) as yanit:
        govde = json.loads(yanit.read().decode("utf-8"))
    satir = govde[0] if isinstance(govde, list) and govde else govde
    if not isinstance(satir, dict):
        raise ValueError("yayinda surum yok")
    return satir


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    # Temiz URL destegi (Vercel cleanUrls ile ayni): /destek -> destek.html
    def send_head(self):
        yol = self.path.split("?", 1)[0].split("#", 1)[0]
        if yol != "/" and "." not in yol.rsplit("/", 1)[-1]:
            aday = yol.rstrip("/") + ".html"
            gercek = os.path.join(self.directory, aday.lstrip("/"))
            if os.path.isfile(gercek):
                if "?" in self.path:
                    self.path = aday + "?" + self.path.split("?", 1)[1]
                else:
                    self.path = aday
        return super().send_head()

    # --- /indir -------------------------------------------------
    def _indir_mi(self):
        return self.path.split("?", 1)[0].split("#", 1)[0].rstrip("/") == "/indir"

    def _indir(self):
        try:
            surum = son_surum()
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError):
            return self._hata(503, "Indirme su an kullanilamiyor. Birazdan tekrar dene.")

        adres = surum.get("indirme_adresi") or ""
        sha256 = surum.get("sha256") or ""

        # Muhur: hash yoksa veya bozuksa indirme yok.
        if not HASH_KURALI.match(sha256):
            return self._hata(503, "Dogrulanmamis surum indirilemez.")
        if not adres.startswith("https://"):
            return self._hata(503, "Indirme adresi tanimli degil.")

        self.send_response(302)
        self.send_header("Location", adres)
        self.send_header("X-Klyze-Surum", str(surum.get("surum", "")))
        self.send_header("X-Klyze-Sha256", sha256)
        self.send_header("X-Robots-Tag", "noindex")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _hata(self, kod, mesaj):
        govde = mesaj.encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(govde)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(govde)

    def do_GET(self):
        if self._indir_mi():
            return self._indir()
        return super().do_GET()

    def do_HEAD(self):
        if self._indir_mi():
            return self._indir()
        return super().do_HEAD()


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
