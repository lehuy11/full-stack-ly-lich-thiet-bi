# Production Dockerfile for T3H-web (React SPA)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
ENV CI=false
RUN npm run build

FROM nginx:1.27-alpine

# Replace default nginx config so SPA routes work on refresh
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
