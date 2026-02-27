FROM node:24-alpine AS builder

ARG IMAGE_NAME=stackweaver-frontend

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage — serve static files with nginx
FROM nginx:alpine

ARG IMAGE_NAME=stackweaver-frontend
ENV IMAGE_NAME=${IMAGE_NAME}

# Copy built frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

LABEL org.opencontainers.image.source="https://github.com/vhco-pro/stackweaver-frontend"
LABEL org.opencontainers.image.licenses="BUSL-1.1"
LABEL org.opencontainers.image.description="Stackweaver Frontend — React SPA for the Stackweaver DevOps platform"

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
