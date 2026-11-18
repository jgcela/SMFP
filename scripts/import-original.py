"""Turn the original portal files (reference/) into what this app serves.

The original site is the Google Drive folder `Portal_202627`
(the same files that run at stmarycommunication.javiercela.me/Portal_202627/).

  reference/portal_202627.original.html -> the home page of the Next.js app:
      app/portal.css            (its <style> block)
      content/portal-body.html  (everything inside <body> except the <script>)
      public/portal.js          (its <script> block)
  reference/<other page>.html  -> public/<other page>.html
  public/assets/               -> the original assets folder, copied as is
                                  (PDFs, images, CSS, School Messenger issues)

The only change to the content: the logo is loaded from this app
(assets/logo_white.png) instead of from stmarycommunication.javiercela.me.
Every other link stays exactly as in the original, so pages, PDFs and images
are served by this app.

Run: python3 scripts/import-original.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = ROOT / "reference"
OLD_LOGO = "https://stmarycommunication.javiercela.me/portal/assets/logo_white.png"
NEW_LOGO = "assets/logo_white.png"

def fix(text):
    return text.replace(OLD_LOGO, NEW_LOGO)

src = (REF / "portal_202627.original.html").read_text(encoding="utf-8")
css = re.search(r"<style>\n?(.*?)</style>", src, re.S).group(1)
body = re.search(r"<body>\n?(.*?)<script>", src, re.S).group(1)
js = re.search(r"<script>\n?(.*?)</script>", src, re.S).group(1)
(ROOT / "app/portal.css").write_text(css, encoding="utf-8")
(ROOT / "content/portal-body.html").write_text(fix(body), encoding="utf-8")
(ROOT / "public/portal.js").write_text(fix(js), encoding="utf-8")

for page in sorted(REF.glob("*_202627.html")):
    (ROOT / "public" / page.name).write_text(fix(page.read_text(encoding="utf-8")), encoding="utf-8")
    print("page", page.name)
