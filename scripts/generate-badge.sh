#!/usr/bin/env bash

# Generate Demo Status Badge for README
# Creates a badge showing if the demo is passing

set -euo pipefail

BADGE_FILE="demo-badge.svg"
STATUS=${1:-passing}
COLOR=${2:-brightgreen}

# Create badge SVG
cat > "$BADGE_FILE" << EOF
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="88" height="20" role="img" aria-labelledby="demo-passing-title"><title>demo: $STATUS</title>
  <defs>
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
  </defs>
  <clipPath id="r">
    <rect width="88" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="37" height="20" fill="#555"/>
    <rect x="37" width="51" height="20" fill="#$COLOR"/>
    <rect width="88" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="195" y="140" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="270">demo</text>
    <text x="195" y="130" transform="scale(.1)" fill="#fff" textLength="270">demo</text>
    <text aria-hidden="true" x="615" y="140" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="410">$STATUS</text>
    <text x="615" y="130" transform="scale(.1)" fill="#fff" textLength="410">$STATUS</text>
  </g>
</svg>
EOF

echo "✅ Badge generated: $BADGE_FILE"
echo "📊 Status: $STATUS (color: $COLOR)"
