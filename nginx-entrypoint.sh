#!/bin/sh
# Render `nginx.conf.template` → `/etc/nginx/conf.d/site.conf`, substituting
# ONLY the `${PORT}` placeholder. Other `$variables` (e.g. $uri) are kept
# verbatim because Nginx needs them at request time.
#
# This hook lives in /docker-entrypoint.d/, which the official `nginx:alpine`
# base image runs before exec'ing the CMD.
set -eu

PORT="${PORT:-8080}"
export PORT

envsubst '${PORT}' \
    < /etc/nginx/templates/site.conf.template \
    > /etc/nginx/conf.d/site.conf

# Helpful at boot — visible in `heroku logs --tail`.
echo "[nginx-entrypoint] rendered site.conf on port ${PORT}"
