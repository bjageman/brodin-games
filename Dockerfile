# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_NTFY_SERVER_URL
ENV VITE_NTFY_SERVER_URL=$VITE_NTFY_SERVER_URL

ARG VITE_NTFY_ADMIN_USERNAME
ENV VITE_NTFY_ADMIN_USERNAME=$VITE_NTFY_ADMIN_USERNAME

ARG VITE_NTFY_ADMIN_PASSWORD
ENV VITE_NTFY_ADMIN_PASSWORD=$VITE_NTFY_ADMIN_PASSWORD

ARG VITE_DEBUG
ENV VITE_DEBUG=$VITE_DEBUG

RUN npm run build

# Serve stage
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
