#!/bin/bash
# Trustea — Testnet deployment script
#
# Prerequisites:
#   - sui CLI installed and configured: `sui client envs` shows testnet
#   - Active testnet address with SUI: `sui client active-address`
#   - Gas tokens: get from https://discord.gg/sui (faucet)
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh

set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../contracts" && pwd)"

echo "=== Trustea Testnet Deployment ==="
echo ""
echo "Contracts dir : $CONTRACTS_DIR"
echo "Active address: $(sui client active-address)"
echo "Active env    : $(sui client active-env)"
echo ""

# Confirm we're on testnet
ENV=$(sui client active-env)
if [[ "$ENV" != "testnet" ]]; then
  echo "ERROR: Active env is '$ENV', expected 'testnet'."
  echo "Switch with: sui client switch --env testnet"
  exit 1
fi

echo "Step 1: Building contracts..."
cd "$CONTRACTS_DIR"
sui move build

echo ""
echo "Step 2: Running tests..."
sui move test

echo ""
echo "Step 3: Publishing package to testnet..."
PUBLISH_OUTPUT=$(sui client publish --gas-budget 200000000 2>&1)
echo "$PUBLISH_OUTPUT"

# Extract package ID from publish output
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -oE '"packageId": "0x[a-f0-9]+"' | head -1 | grep -oE '0x[a-f0-9]+')

if [[ -z "$PACKAGE_ID" ]]; then
  # Try alternate format
  PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -A2 "Published Objects" | grep -oE '0x[a-f0-9]{64}' | head -1)
fi

if [[ -z "$PACKAGE_ID" ]]; then
  echo ""
  echo "WARNING: Could not auto-extract package ID. Check the publish output above."
  echo "Manually set TRUSTEA_PACKAGE_ID in lib/config.ts"
else
  echo ""
  echo "=== Deployment Success ==="
  echo "Package ID: $PACKAGE_ID"
  echo ""
  echo "Next step: update lib/config.ts"
  echo "  seal.packageId: \"$PACKAGE_ID\""
fi
