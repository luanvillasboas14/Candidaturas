#!/bin/sh
set -e

if [ -z "$SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
fi

if [ -z "$SUPABASE_ANON_KEY" ] && [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  export SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

# Docker/EasyPanel always set HOSTNAME to the container id. Next standalone
# binds to that value and can exit with EADDRNOTAVAIL.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

exec node server.js
