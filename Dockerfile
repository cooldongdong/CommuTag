# Build the frontend, then ship only what the server needs.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json server.js ./
COPY app ./app
COPY view ./view
COPY static ./static
COPY scripts ./scripts
RUN mkdir -p log && chown node:node log
USER node
EXPOSE 8001
CMD ["node", "server.js"]
