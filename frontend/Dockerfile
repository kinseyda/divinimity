# ===== Build Stage =====
FROM node:lts-alpine AS build
WORKDIR /app


ARG PUBLIC_URL
ENV PUBLIC_URL=$PUBLIC_URL
ARG PUBLIC_BACKEND_URL
ENV PUBLIC_BACKEND_URL=$PUBLIC_BACKEND_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ===== Runtime Stage =====
FROM nginx:alpine AS runtime
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
