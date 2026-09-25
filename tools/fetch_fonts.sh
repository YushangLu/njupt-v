#!/usr/bin/env bash
# Downloads the full source fonts (SIL Open Font License) from Google Fonts
# into .cache/fonts. Only needed when on-screen text changes and the subsets
# in src/fonts must be rebuilt with `python3 tools/build_fonts.py`.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .cache/fonts
css=""
for fam in "Noto+Sans+SC:wght@300;500;700;900" "Noto+Serif+SC:wght@600;900" "Ma+Shan+Zheng" \
           "Space+Grotesk:wght@300;400;500;700" "JetBrains+Mono:wght@400;700"; do
  # No browser user agent -> the API answers with full TTF files.
  css+=$(curl -fsS "https://fonts.googleapis.com/css2?family=${fam}")
done
python3 - "$css" <<'PY'
import re, subprocess, sys
for fam, w, url in re.findall(r"font-family: '([^']+)';.*?font-weight: (\d+);.*?src: url\((\S+?)\)", sys.argv[1], re.S):
    out = f".cache/fonts/{fam.replace(' ', '')}-{w}.ttf"
    subprocess.run(["curl", "-fsS", "-o", out, url], check=True)
    print(out)
PY
