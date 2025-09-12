# Build MCP server
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm ci && npm run build

# Runtime image
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/scripts /app/scripts
EXPOSE 8080
ENTRYPOINT ["node", "/app/dist/index.js"]

