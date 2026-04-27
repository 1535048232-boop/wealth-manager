from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import os


DIST_DIR = Path(__file__).resolve().parents[1] / "dist"


class ExportRouteHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        clean_path = unquote(parsed.path)
        relative = clean_path.lstrip("/")

        candidates = []
        if not relative or relative.endswith("/"):
          target = f"{relative}index" if relative else "index"
          candidates.extend([f"{target}.html", target])
        else:
          candidates.extend([relative, f"{relative}.html", str(Path(relative) / "index.html")])

        for candidate in candidates:
            file_path = DIST_DIR / candidate
            if file_path.exists():
                return str(file_path)

        return str(DIST_DIR / "index.html")


if __name__ == "__main__":
    os.chdir(DIST_DIR)
    server = ThreadingHTTPServer(("0.0.0.0", 4173), ExportRouteHandler)
    print("Serving dist with route fallback on http://localhost:4173")
    server.serve_forever()
