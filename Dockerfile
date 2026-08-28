# ----------------------------
# сборка
# ----------------------------
# Angular 21 требует Node ^20.19 || ^22.12 || >=24: на прежнем node:18
# сборка падает ещё до вызова ng.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# ci вместо install --force: флаг был нужен из-за конфликтов peer-зависимостей
# старого набора пакетов, которых больше нет.
RUN npm ci

COPY . .
RUN npm run build

# ----------------------------
# раздача через nginx
# ----------------------------
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d
COPY --from=build /app/dist/spending-tracker.gui /usr/share/nginx/html

EXPOSE 80
