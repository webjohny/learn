# Node 22+ обов'язковий: сервер використовує вбудований `node:sqlite`.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Перевіряємо наявність node:sqlite саме тут, а не в рантаймі під навантаженням.
RUN node -e "require('node:sqlite')" \
  && apk add --no-cache wget

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# Каталог під SQLite; у compose монтується іменований том.
RUN mkdir -p /app/data

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/auth/me 2>&1 | grep -q . || exit 1

CMD ["node", "dist-server/main.js"]
