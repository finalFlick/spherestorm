#!/bin/sh

# Runtime config injection from Docker environment variables
# - ENABLE_DEBUG: 'true' enables debug UI; default false
# - PLAYTEST_URL / PLAYTEST_TOKEN: override playtest feedback endpoint at runtime
ENABLE_DEBUG_VAL="${ENABLE_DEBUG:-false}"
PLAYTEST_URL_VAL="${PLAYTEST_URL:-}"
PLAYTEST_TOKEN_VAL="${PLAYTEST_TOKEN:-}"

# Normalize ENABLE_DEBUG to JS boolean literal
case "$(printf '%s' "$ENABLE_DEBUG_VAL" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|y|on) ENABLE_DEBUG_JS=true ;;
  *) ENABLE_DEBUG_JS=false ;;
esac

# Escape a string for safe inclusion inside a double-quoted JS string literal.
# Escapes: backslash, double-quote, and newlines/carriage returns.
escape_js_string() {
  # Slurp full input (including newlines), then escape.
  printf '%s' "$1" | sed \
    -e ':a' -e 'N' -e '$!ba' \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e 's/\r/\\r/g' \
    -e 's/\n/\\n/g'
}

PLAYTEST_URL_ESC="$(escape_js_string "$PLAYTEST_URL_VAL")"
PLAYTEST_TOKEN_ESC="$(escape_js_string "$PLAYTEST_TOKEN_VAL")"

# Build runtime config script. Only include optional fields when non-empty.
CONFIG_SCRIPT="<script>window.__RUNTIME_CONFIG__={debug:${ENABLE_DEBUG_JS}"
[ -n "$PLAYTEST_URL_VAL" ] && CONFIG_SCRIPT="${CONFIG_SCRIPT},playtestUrl:\"${PLAYTEST_URL_ESC}\""
[ -n "$PLAYTEST_TOKEN_VAL" ] && CONFIG_SCRIPT="${CONFIG_SCRIPT},playtestToken:\"${PLAYTEST_TOKEN_ESC}\""
CONFIG_SCRIPT="${CONFIG_SCRIPT}};</script>"

# Inject into index.html if placeholder exists (idempotent if already injected)
INDEX_HTML="/usr/share/nginx/html/index.html"
if [ -f "$INDEX_HTML" ] && grep -q "<!-- RUNTIME_CONFIG_PLACEHOLDER -->" "$INDEX_HTML"; then
  # Escape for sed replacement: &, |, and backslashes must be escaped.
  CONFIG_SCRIPT_SED="$(printf '%s' "$CONFIG_SCRIPT" | sed -e 's/[\\&|]/\\&/g')"
  sed -i "s|<!-- RUNTIME_CONFIG_PLACEHOLDER -->|$CONFIG_SCRIPT_SED|g" "$INDEX_HTML"
fi

# Get the actual port nginx is listening on from config
NGINX_PORT=$(grep -m1 'listen' /etc/nginx/conf.d/default.conf | grep -oE '[0-9]+' | head -1)
NGINX_PORT=${NGINX_PORT:-80}

echo "========================================"
echo "  MANTA SPHERE"
echo "========================================"
echo "  Server running on port $NGINX_PORT"
echo "  Access at: http://localhost:$NGINX_PORT"
echo "========================================"

exec nginx -g 'daemon off;'
