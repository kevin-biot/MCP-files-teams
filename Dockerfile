## Build MCP server
FROM node:22-alpine AS build
WORKDIR /app

# Copy manifest and sources from build context prepared by the pipeline
COPY package*.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi \
    && npm run build

## Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=dev; else npm install --omit=dev; fi

# Copy compiled app
COPY --from=build /app/dist /app/dist

EXPOSE 8080
ENTRYPOINT ["node", "/app/dist/index.js"]
