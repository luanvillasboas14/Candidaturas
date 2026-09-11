#!/bin/sh
set -e

cd /app

if [ -z "$SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
fi

if [ -z "$SUPABASE_ANON_KEY" ] && [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  export SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

# Docker/EasyPanel set HOSTNAME to the container id. Next standalone binds to it.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

if [ ! -f /app/server.js ]; then
  echo "server.js nao encontrado em /app" >&2
  ls -la /app >&2
  exit 1
fi

echo "Iniciando Next em ${HOSTNAME}:${PORT}"
exec node /app/server.js
