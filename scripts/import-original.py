"""Split the original portal page (reference/portal_202627.original.html) into the
pieces the Next.js app uses, without changing their content:

  app/portal.css        <- the <style> block
  content/portal-body.html <- everything inside <body> except the <script>
  public/portal.js      <- the <script> block

Only one thing changes: relative links ("assets/...", "handbook_202627.html")
become absolute links to the original site, because those pages and files
are not part of this app yet. The logo and favicon are served from /public.

Run: python3 scripts/import-original.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://stmarycommunication.javiercela.me/Portal_202627/"
src = (ROOT / "reference/portal_202627.original.html").read_text(encoding="utf-8")

css = re.search(r"<style>\n?(.*?)</style>", src, re.S).group(1)
body = re.search(r"<body>\n?(.*?)<script>", src, re.S).group(1)
js = re.search(r"<script>\n?(.*?)</script>", src, re.S).group(1)

def is_relative(u):
    return not re.match(r"^(#|https?:|mailto:|tel:|webcal:|/|\$\{)", u)

# Markup: href="..." / src="..."
def fix_attr(m):
    attr, url = m.group(1), m.group(2)
    if url == "https://stmarycommunication.javiercela.me/portal/assets/logo_white.png":
        return f'{attr}="/logo_white.png"'
    return f'{attr}="{BASE + url}"' if is_relative(url) else m.group(0)
body = re.sub(r'\b(href|src)="([^"]*)"', fix_attr, body)

# Script data: string literals that are relative file/page paths
def fix_str(m):
    q, url = m.group(1), m.group(2)
    return f"{q}{BASE + url}{q}"
js = re.sub(r"""(['"])((?:assets/[^'"]+)|(?:[\w-]+_202627\.html))\1""", fix_str, js)

(ROOT / "app/portal.css").write_text(css, encoding="utf-8")
(ROOT / "content/portal-body.html").write_text(body, encoding="utf-8")
(ROOT / "public/portal.js").write_text(js, encoding="utf-8")
print("css", len(css), "body", len(body), "js", len(js))
