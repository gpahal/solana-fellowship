#!/usr/bin/env bash

PROGRAM_DIR="$1"
if [[ -z $PROGRAM_DIR ]]; then
  echo "Usage: $0 <solana-program-directory-path> <new-solana-version>"
  exit 1
fi

NEW_SOLANA_VERSION="$2"
if [[ -z $NEW_SOLANA_VERSION ]]; then
  echo "Usage: $0 <solana-program-path> <new-solana-version>"
  exit 1
fi

if [[ $NEW_SOLANA_VERSION =~ ^v ]]; then
  # Drop `v` from v1.2.3...
  NEW_SOLANA_VERSION=${NEW_SOLANA_VERSION:1}
fi

cd "$PROGRAM_DIR"
echo "Updating Solana version to $NEW_SOLANA_VERSION in $PWD"

if ! git diff --quiet && [[ -z $DIRTY_OK ]]; then
  echo "Error: dirty tree"
  exit 1
fi

declare TOMLs=()
while IFS='' read -r line; do TOMLs+=("$line"); done < <(find . -name Cargo.toml)

crates=(
  solana-clap-utils
  solana-cli-config
  solana-client
  solana-logger
  solana-program
  solana-program-test
  solana-remote-wallet
  solana-sdk
  solana-validator
)

set -x
for crate in "${crates[@]}"; do
  sed -i -e "s#\(${crate} = \"\).*\(\"\)#\1$NEW_SOLANA_VERSION\2#g" "${TOMLs[@]}"
  sed -i -e "s#\(${crate} = {.*version = \"\).*\(\".*}\)#\1$NEW_SOLANA_VERSION\2#g" "${TOMLs[@]}"
done
