#!/usr/bin/env bash
# Submit every <loc> from sitemap.xml to the IndexNow API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITEMAP="${INDEXNOW_SITEMAP:-${ROOT}/sitemap.xml}"
HOST="jojomelon.pl"
KEY="d53ead29576e4611af1a6761e2f65aa3"
KEY_LOCATION="https://${HOST}/${KEY}.txt"
ENDPOINT="${INDEXNOW_ENDPOINT:-https://api.indexnow.org/indexnow}"

if [[ ! -f "$SITEMAP" ]]; then
  echo "Missing sitemap: ${SITEMAP}" >&2
  exit 1
fi

payload="$(
  python3 - "$SITEMAP" "$HOST" "$KEY" "$KEY_LOCATION" << 'PY'
import json
import re
import sys

sitemap, host, key, key_location = sys.argv[1:5]
text = open(sitemap, encoding="utf-8").read()
urls = []
for match in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", text):
    url = match.strip()
    if url and url not in urls:
        urls.append(url)
if not urls:
    raise SystemExit("sitemap.xml has no <loc> URLs")
json.dump(
    {
        "host": host,
        "key": key,
        "keyLocation": key_location,
        "urlList": urls,
    },
    sys.stdout,
    ensure_ascii=False,
)
PY
)"

if [[ "${1:-}" == "--dry-run" ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

code="$(
  curl --silent --show-error --location \
    --output "$tmp" \
    --write-out '%{http_code}' \
    --request POST \
    --header 'Content-Type: application/json; charset=utf-8' \
    --data "$payload" \
    "$ENDPOINT"
)"

echo "IndexNow HTTP ${code}"
if [[ -s "$tmp" ]]; then
  cat "$tmp"
  printf '\n'
fi

case "$code" in
  200|202) exit 0 ;;
  *) exit 1 ;;
esac
