#!/usr/bin/env bash
set -euo pipefail

echo "Building with bundle analysis..."
VITE_ANALYZE=true npx vite build
echo ""
echo "Bundle report generated at dist/bundle-report.html"
echo "Open it in your browser to inspect chunk sizes."
