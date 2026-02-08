#!/bin/bash
set -e

# Source cargo environment if available (for CI compatibility)
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

export PATH="$HOME/.cargo/bin:$PATH"

echo "Using rustc: $(which rustc) - $(rustc --version)"
echo "Using cargo: $(which cargo)"

# Store original program ID
ORIGINAL_ID=$(grep -oP 'declare_id!\("\K[^"]+' programs/stealth-registry/src/lib.rs)

# Sync keys for testing (generates keypair if needed and updates lib.rs)
echo "Syncing program keys for testing..."
anchor keys sync

# Run tests
echo "Running anchor tests..."
anchor test

# Revert lib.rs to original production ID
echo "Reverting to production program ID: $ORIGINAL_ID"
sed -i "s/declare_id!(\"[^\"]*\");/declare_id!(\"$ORIGINAL_ID\");/" programs/stealth-registry/src/lib.rs

echo "Tests completed successfully!"
