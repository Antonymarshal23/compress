FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
RUN mkdir -p /tmp/paperpilot-jobs && chown -R node:node /app /tmp/paperpilot-jobs
USER node
EXPOSE 5000
CMD ["npm", "run", "start", "--workspace", "apps/api"]
