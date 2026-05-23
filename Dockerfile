FROM node:24-alpine AS builder

# BUILD_ROOT controls where frontend source lives relative to the build context.
# - Distribution repo (context = frontend dir):  BUILD_ROOT=. (default)
# - Monorepo (context = repo root):              BUILD_ROOT=frontend
ARG BUILD_ROOT=.

# WORKDIR /frontend so build-docs-index.js relative paths resolve correctly:
#   script __dirname = /scripts  →  ../docs = /docs  ✓
#                                    ../frontend/public = /frontend/public  ✓
WORKDIR /frontend

# Copy package files first for caching
COPY ${BUILD_ROOT}/package*.json ./
RUN npm ci

# Copy frontend source, scripts, and docs to their expected locations
COPY ${BUILD_ROOT}/ .
COPY scripts/ /scripts/
COPY docs/ /docs/
# Stage nginx.conf alongside the build output so the runtime stage can find it
# without needing the BUILD_ROOT arg (args don't carry across stages).
COPY ${BUILD_ROOT}/nginx.conf /frontend/nginx.conf
RUN npm run build

# Runtime stage — Chainguard nginx: zero CVEs, non-root by default
FROM cgr.dev/chainguard/nginx@sha256:8c068cdde0c972ffcbfbb2954525f68d180c1be3ac16b3b7573cc7188cc87c96

COPY --from=builder /frontend/dist /usr/share/nginx/html
# Chainguard nginx ships nginx.default.conf — overwrite it with our SPA config
COPY --from=builder /frontend/nginx.conf /etc/nginx/conf.d/nginx.default.conf

LABEL org.opencontainers.image.source="https://github.com/vhco-pro/stackweaver-frontend"
LABEL org.opencontainers.image.licenses="BUSL-1.1"
LABEL org.opencontainers.image.description="Stackweaver Frontend — React SPA for the Stackweaver DevOps platform"

EXPOSE 8080
