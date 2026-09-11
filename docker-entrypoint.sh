#!/bin/sh
set -e

if [ -z "$SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
fi

if [ -z "$SUPABASE_ANON_KEY" ] && [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  export SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

exec node server.js
