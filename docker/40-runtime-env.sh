#!/bin/sh
set -eu

target="${RUNTIME_ENV_FILE:-/usr/share/nginx/html/env.js}"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

{
  printf 'window.RUNTIME_ENV = {\n'
  printf '  "VITE_SUPABASE_URL": "%s",\n' "$(json_escape "${VITE_SUPABASE_URL:-}")"
  printf '  "VITE_SUPABASE_ANON_KEY": "%s",\n' "$(json_escape "${VITE_SUPABASE_ANON_KEY:-}")"
  printf '  "VITE_API": "%s"\n' "$(json_escape "${VITE_API:-supabase}")"
  printf '};\n'
} > "$target"

echo "$0: wrote runtime config to $target (VITE_API=${VITE_API:-supabase})"
