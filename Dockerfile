# syntax=docker/dockerfile:1.6
#
# Stromteilung frontend — multi-stage build.
#
# Stage 1 (builder) runs `npm ci` + `vite build` inside Node Alpine, with a
# BuildKit cache mount over `~/.npm` so dependency installs are sub-second on
# rebuilds.
#
# Stage 2 (runtime) is just Nginx serving the static bundle, sized in MB.
#
# `VITE_API_URL` is a *build-time* var — Vite inlines it into the JS bundle,
# so it must be set before `vite build` runs. On Heroku we pass it via
# `heroku container:push --arg VITE_API_URL=...` (see DEPLOY.md).

ARG VITE_API_URL=http://localhost:8000/api/v1

# ============================================================================
# Stage 1 — builder
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Lockfile first — cache the install layer until package*.json change.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --prefer-offline

# Now copy source. Anything matched by .dockerignore stays out.
COPY . .

# Re-declare ARG in this stage so Vite sees it via ENV.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL} \
    NODE_ENV=production

# Build the static bundle. Vite outputs to /app/dist.
RUN npm run build


# ============================================================================
# Stage 2 — runtime (Nginx)
# ============================================================================
FROM nginx:1.27-alpine AS runtime

# Drop the default site config; we install our own template.
RUN rm /etc/nginx/conf.d/default.conf

# Static bundle from the builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Server config template — `$PORT` substituted at container start so Heroku's
# random port assignment works.
COPY nginx.conf.template /etc/nginx/templates/site.conf.template

# Entrypoint that envsubsts $PORT (only) into the template and then exec's nginx.
COPY nginx-entrypoint.sh /docker-entrypoint.d/40-render-template.sh
RUN chmod +x /docker-entrypoint.d/40-render-template.sh

# Sensible local default; Heroku overrides at runtime.
ENV PORT=8080
EXPOSE 8080

# The base image's entrypoint runs every executable in /docker-entrypoint.d/*
# then `exec "$@"` — so our envsubst hook fires, then nginx starts.
CMD ["nginx", "-g", "daemon off;"]
