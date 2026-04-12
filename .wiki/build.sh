#!/usr/bin/env bash
# night wiki build — markdown tree → html wiki via pandoc
#
# Runs locally or in CI. Output goes to $REPO_ROOT/_site (gitignored).
# Nothing writes back to the repo itself.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$REPO_ROOT/_site"

cd "$REPO_ROOT"
rm -rf "$OUT"
mkdir -p "$OUT"

# Copy the stylesheet to the site root.
cp "$SCRIPT_DIR/style.css" "$OUT/style.css"

# Copy static assets (images) preserving directory structure.
find . -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \
  -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" -o -name "*.ico" \) \
  -not -path "./_site/*" -not -path "./.git/*" -not -path "*/node_modules/*" \
  | while IFS= read -r img; do
    img="${img#./}"
    mkdir -p "$OUT/$(dirname "$img")"
    cp "$img" "$OUT/$img"
  done

# Derive the GitHub repo URL from the origin remote, normalizing SSH → HTTPS.
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [[ -n "$REMOTE" ]]; then
  REPO_URL=$(printf '%s' "$REMOTE" | sed -E 's|^git@([^:]+):|https://\1/|; s|\.git$||')
else
  REPO_URL=""
fi

# Collect all markdown files, excluding build output, git internals, the wiki
# tooling itself, archives, and node_modules. Portable to bash 3.2 (macOS).
MD_FILES=()
while IFS= read -r line; do
  MD_FILES+=("$line")
done < <(
  find . -type f -name "*.md" \
    -not -path "./_site/*" \
    -not -path "./.git/*" \
    -not -path "./.github/*" \
    -not -path "./.wiki/*" \
    -not -path "./.claude/*" \
    -not -path "./archive/*" \
    -not -path "*/node_modules/*" \
    -not -name ".#*.md" \
    | sed 's|^\./||' \
    | sort
)

if [[ ${#MD_FILES[@]} -eq 0 ]]; then
  echo "No markdown files found." >&2
  exit 1
fi

# Render each file.
for f in "${MD_FILES[@]}"; do
  dir=$(dirname "$f")
  if [[ "$dir" == "." ]]; then
    depth=""
  else
    # For a file n levels deep, the prefix back to site root is "../" * n.
    depth=$(awk -F/ 'BEGIN{}{s=""; for(i=1;i<=NF;i++) s=s "../"; print s}' <<<"$dir")
  fi

  sidebar_html=$(python3 "$SCRIPT_DIR/tree.py" "$depth" "$f" "${MD_FILES[@]}")
  out_file="$OUT/${f%.md}.html"
  mkdir -p "$(dirname "$out_file")"

  pandoc "$f" \
    --from gfm \
    --to html5 \
    --standalone \
    --template "$SCRIPT_DIR/template.html" \
    --lua-filter "$SCRIPT_DIR/rewrite-md.lua" \
    --variable sidebar="$sidebar_html" \
    --variable root="$depth" \
    --variable repo_url="$REPO_URL" \
    --output "$out_file"
done

# Root index.html — use README.html if present, otherwise the first file.
if [[ -f "$OUT/README.html" ]]; then
  cp "$OUT/README.html" "$OUT/index.html"
else
  first_html="$OUT/${MD_FILES[0]%.md}.html"
  [[ -f "$first_html" ]] && cp "$first_html" "$OUT/index.html"
fi

echo "Built ${#MD_FILES[@]} pages → $OUT"
