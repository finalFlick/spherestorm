#!/bin/sh

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
