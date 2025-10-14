# ===== Build Stage =====
FROM node:lts-alpine AS build
WORKDIR /app

#	- PUBLIC_BACKEND_URL=https://divinimity.kinseyda.com/api # This is used by the frontend to call the backend, i.e. by the browser
#   - PUBLIC_WEBSOCKET_URL=wss://divinimity.kinseyda.com
#   - PUBLIC_WEBSOCKET_PATH=/ws
#   - PUBLIC_URL=https://divinimity.kinseyda.com

ARG PUBLIC_URL
ENV PUBLIC_URL=$PUBLIC_URL
ARG PUBLIC_BACKEND_URL
ENV PUBLIC_BACKEND_URL=$PUBLIC_BACKEND_URL
ARG PUBLIC_WEBSOCKET_URL
ENV PUBLIC_WEBSOCKET_URL=$PUBLIC_WEBSOCKET_URL
ARG PUBLIC_WEBSOCKET_PATH
ENV PUBLIC_WEBSOCKET_PATH=$PUBLIC_WEBSOCKET_PATH

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
