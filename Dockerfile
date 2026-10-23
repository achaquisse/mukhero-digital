# syntax=docker/dockerfile:1

FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.31-alpine AS runtime
ENV VITE_SUPABASE_URL="" \
    VITE_SUPABASE_ANON_KEY="" \
    VITE_API=supabase \
    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="" \
    SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=""
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
