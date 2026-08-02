FROM node:24-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS builder

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
# Stage nginx.conf + the security-headers snippet alongside the build output so
# the runtime stage can find them without needing the BUILD_ROOT arg (args don't
# carry across stages).
COPY ${BUILD_ROOT}/nginx.conf /frontend/nginx.conf
COPY ${BUILD_ROOT}/security-headers.conf /frontend/security-headers.conf
RUN npm run build

# Runtime stage — Chainguard nginx: zero CVEs, non-root by default
FROM cgr.dev/chainguard/nginx@sha256:e4ff957080737c90a9ecfeaa40e3d19ea9d687e9cacda2f2a031c75ffcdd72b7

COPY --from=builder /frontend/dist /usr/share/nginx/html
# Chainguard nginx ships nginx.default.conf — overwrite it with our SPA config.
# The security-headers snippet lives OUTSIDE conf.d/ (the top-level nginx.conf
# does `include /etc/nginx/conf.d/*.conf`, so a snippet in conf.d/ would be
# double-loaded at http scope and via our explicit include). It is pulled in by
# absolute-path `include` directives in nginx.conf.
COPY --from=builder /frontend/nginx.conf /etc/nginx/conf.d/nginx.default.conf
COPY --from=builder /frontend/security-headers.conf /etc/nginx/security-headers.conf

LABEL org.opencontainers.image.source="https://github.com/vhco-pro/stackweaver-frontend"
LABEL org.opencontainers.image.licenses="BUSL-1.1"
LABEL org.opencontainers.image.description="Stackweaver Frontend — React SPA for the Stackweaver DevOps platform"

EXPOSE 8080
