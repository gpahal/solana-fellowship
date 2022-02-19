#!/usr/bin/env bash

prog_dir="$1"
if [[ -z $prog_dir ]]; then
  echo "Usage: $0 <solana-program-directory-path> <new-solana-version>"
  exit 1
fi

solana_ver="$2"
if [[ -z $solana_ver ]]; then
  echo "Usage: $0 <solana-program-path> <new-solana-version>"
  exit 1
fi

if [[ $solana_ver =~ ^v ]]; then
  # Drop `v` from v1.2.3...
  solana_ver=${solana_ver:1}
fi

cd "$prog_dir"

echo "Updating Solana version to $solana_ver in $PWD"

if ! git diff --quiet && [[ -z $DIRTY_OK ]]; then
  echo "Error: dirty tree"
  exit 1
fi

declare tomls=()
while IFS='' read -r line; do tomls+=("$line"); done < <(find . -name Cargo.toml)

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
  sed -i -e "s#\(${crate} = \"\).*\(\"\)#\1$solana_ver\2#g" "${tomls[@]}"
  sed -i -e "s#\(${crate} = {.*version = \"\).*\(\".*}\)#\1$solana_ver\2#g" "${tomls[@]}"
done
