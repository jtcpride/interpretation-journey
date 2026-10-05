#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
fi
node server.mjs
