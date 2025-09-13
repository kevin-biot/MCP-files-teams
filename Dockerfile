## Build MCP server
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Copy manifest and sources from build context prepared by the pipeline
COPY package*.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && if [ -f package-lock.json ]; then npm ci; else npm install; fi \
    && npm run build

## Runtime image
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=dev; else npm install --omit=dev; fi \
    && rm -rf /root/.npm

# Copy compiled app
COPY --from=build /app/dist /app/dist
COPY --from=build /app/scripts /app/scripts

EXPOSE 8080
ENTRYPOINT ["node", "/app/dist/index.js"]
