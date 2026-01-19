#!/bin/bash
set -e

# 1. Build the BPF Binary (stealth_registry.so)
# We force the use of the cached Solana platform tools to bypass 'rustup' shim issues.

# Adjust this path if your platform tools are in a different version/location
TOOLCHAIN_DIR="$HOME/.cache/solana/v1.51/platform-tools/rust"

if [ -d "$TOOLCHAIN_DIR" ]; then
    echo "✅ Found Solana platform tools at $TOOLCHAIN_DIR"
    export PATH="$TOOLCHAIN_DIR/bin:$PATH"
    export RUSTC="$TOOLCHAIN_DIR/bin/rustc"
    
    echo "🛠️  Building Program Binary..."
    cd programs/stealth-registry
    
    # Use --no-rustup-override because we are manually overriding PATH
    cargo build-sbf --no-rustup-override
    
    echo "✅ Build Success! Artifact: programs/stealth-registry/target/deploy/stealth_registry.so"
else
    echo "❌ Error: Could not find Solana platform tools at $TOOLCHAIN_DIR"
    echo "Please find where 'cargo-build-sbf' installed the platform-tools and update this script."
    exit 1
fi

# 2. Build IDL (Optional / WIP)
# Note: IDL generation currently fails due to 'anchor-syn' dependency issues on this setup.
# To attempt IDL build, we would need to switch back to the standard Rustup toolchain.
# echo "🛠️  Building IDL..."
# export PATH="$HOME/.cargo/bin:$PATH" # Reset PATH to use rustup shim
# anchor idl build
