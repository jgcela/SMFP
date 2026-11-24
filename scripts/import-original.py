"""Turn the original portal files (reference/) into what this app serves.

The original site is the school's Google Drive folder `Portal_202627`
(the same files the old website serves).

  reference/portal_202627.original.html -> app/portal.css (its <style> block)
      Since step 2 the home page's markup (content/portal-template.html),
      script (public/portal.js) and content (the database, see
      scripts/seed-from-original.mjs) are no longer generated here.
  reference/<other page>.html  -> public/<other page>.html
  public/assets/               -> the original assets folder, copied as is
                                  (PDFs, images, CSS, School Messenger issues)

Changes to the content:
- the logo is loaded from this app (assets/logo_white.png) instead of from
  the old website;
- every page (and every School Messenger issue) loads /new-tab.js, so links
  to files and other websites open in a new tab; links between the portal's
  own pages stay in the same tab (asked for on 2026-11-18).
The links themselves stay exactly as in the original, so pages, PDFs and
images are served by this app.

Run: python3 scripts/import-original.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = ROOT / "reference"
OLD_LOGO = re.compile(r"https://[^\"'\s]+/portal/assets/logo_white\.png")
NEW_LOGO = "assets/logo_white.png"

NEW_TAB = '<script src="/new-tab.js"></script>\n'

def fix(text):
    return OLD_LOGO.sub(NEW_LOGO, text)

def add_new_tab(text):
    if NEW_TAB in text:
        return text
    i = text.rindex("</body>")
    return text[:i] + NEW_TAB + text[i:]

src = (REF / "portal_202627.original.html").read_text(encoding="utf-8")
css = re.search(r"<style>\n?(.*?)</style>", src, re.S).group(1)
# The stylesheet is the same for every school: drop the school's name from its first comment.
css = re.sub(r"^/\* =+ .*? design system tokens =+ \*/", "/* ===== Design system tokens ===== */", css, count=1)
(ROOT / "app/portal.css").write_text(css, encoding="utf-8")

for page in sorted(REF.glob("*_202627.html")):
    (ROOT / "public" / page.name).write_text(add_new_tab(fix(page.read_text(encoding="utf-8"))), encoding="utf-8")
    print("page", page.name)

for issue in sorted((ROOT / "public/assets/messenger/data").glob("*.html")):
    # newline="" keeps the issue's own line endings (CRLF) untouched.
    with open(issue, encoding="utf-8", newline="") as f:
        text = f.read()
    with open(issue, "w", encoding="utf-8", newline="") as f:
        f.write(add_new_tab(text))
    print("messenger issue", issue.name)
