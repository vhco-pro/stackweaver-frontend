FROM node:24-alpine AS builder

# WORKDIR /frontend so build-docs-index.js relative paths resolve correctly:
#   script __dirname = /scripts  →  ../docs = /docs  ✓
#                                    ../frontend/public = /frontend/public  ✓
WORKDIR /frontend

# Copy package files first for caching
COPY package*.json ./
RUN npm ci

# Copy frontend source, scripts, and docs to their expected locations
COPY . .
COPY scripts/ /scripts/
COPY docs/ /docs/
RUN npm run build

# Runtime stage — Chainguard nginx: zero CVEs, non-root by default
FROM cgr.dev/chainguard/nginx@sha256:8987b562107b4275bd594b9dcf2def36737720460b12fce90bb13c729353ca54

COPY --from=builder /frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

LABEL org.opencontainers.image.source="https://github.com/vhco-pro/stackweaver-frontend"
LABEL org.opencontainers.image.licenses="BUSL-1.1"
LABEL org.opencontainers.image.description="Stackweaver Frontend — React SPA for the Stackweaver DevOps platform"

EXPOSE 8080
