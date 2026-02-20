#!/usr/bin/env bash
# =============================================================================
# generate-keys.sh — Generate RSA-2048 key pair for RS256 JWT signing
# Run once before starting the stack:  bash scripts/generate-keys.sh
# =============================================================================
set -euo pipefail

KEYS_DIR="$(dirname "$0")/../app/backend/keys"
mkdir -p "$KEYS_DIR"

PRIVATE_KEY="$KEYS_DIR/private.pem"
PUBLIC_KEY="$KEYS_DIR/public.pem"

if [[ -f "$PRIVATE_KEY" ]]; then
  echo "⚠️  Keys already exist at $KEYS_DIR — skipping generation."
  echo "    Delete them manually and re-run if you want new ones."
  exit 0
fi

echo "🔑 Generating RSA-2048 private key..."
openssl genrsa -out "$PRIVATE_KEY" 2048

echo "🔑 Deriving public key..."
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"

chmod 600 "$PRIVATE_KEY"
chmod 644 "$PUBLIC_KEY"

echo "✅ Keys written to $KEYS_DIR"
echo "   private.pem — keep secret, never commit!"
echo "   public.pem  — safe to distribute"
