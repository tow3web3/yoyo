#!/usr/bin/env bash
# Ship the repo to the VM and restart both services.
# Usage (from the repo root, Git Bash): bash deploy/redeploy.sh
# Never touches the .env files on the VM.
set -euo pipefail
VM="root@65.20.103.177"
KEY="$HOME/.ssh/delta-cr"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "Packing sources"
tar -C "$ROOT" \
  --exclude=node_modules --exclude=.next --exclude=.git --exclude='*.env' --exclude='.env.*' --exclude=.vercel \
  -czf "/tmp/boomerang-$STAMP.tgz" backend frontend contracts deploy README.md

echo "Uploading"
scp -i "$KEY" "/tmp/boomerang-$STAMP.tgz" "$VM:/root/boomerang-$STAMP.tgz"

ssh -i "$KEY" "$VM" bash -s "$STAMP" <<'EOF'
set -euo pipefail
STAMP="$1"
mkdir -p /root/boomerang
cd /root/boomerang
# Keep a backup of the previous sources (env files excluded from the tarball, so they survive).
if [ -d backend ]; then tar -czf "/root/boomerang-prev-$STAMP.tgz" --exclude=node_modules --exclude=.next backend frontend 2>/dev/null || true; fi
tar -xzf "/root/boomerang-$STAMP.tgz"
rm -f "/root/boomerang-$STAMP.tgz"

echo "Backend deps + migrate"
cd /root/boomerang/backend && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -1
# Subshell: backend/.env sets NODE_ENV=production, which must not leak into the frontend install
# (npm would skip tailwindcss and the build fails).
( set -a; . ./.env; set +a; node src/db/migrate.js | tail -1 )

echo "Frontend deps + build"
cd /root/boomerang/frontend && npm ci --include=dev --no-audit --no-fund 2>&1 | tail -1
( set -a; . ./.env.local; set +a; NODE_OPTIONS=--max-old-space-size=2048 npx next build 2>&1 | grep -E "Compiled|rror" | head -3 )
# Standalone output needs the static assets next to server.js.
SA="$(dirname "$(find .next/standalone -maxdepth 2 -name server.js | head -1)")"
mkdir -p "$SA/.next" && cp -r .next/static "$SA/.next/" && cp -r public "$SA/"

systemctl restart boomerang-bot boomerang-web
sleep 3
systemctl is-active boomerang-bot boomerang-web
EOF
echo "Deployed. https://boomerang.65-20-103-177.sslip.io"
