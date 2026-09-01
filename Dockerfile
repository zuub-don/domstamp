# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS gym
WORKDIR /app
COPY gym ./gym
ENV PORT=4173
EXPOSE 4173
USER node
CMD ["node", "gym/server.mjs"]

FROM mcr.microsoft.com/playwright:v1.62.0-noble AS runner
WORKDIR /work
COPY package.json package-lock.json* ./
COPY packages/domstamp/package.json ./packages/domstamp/package.json
COPY packages/tq1/package.json ./packages/tq1/package.json
COPY packages/playwright/package.json ./packages/playwright/package.json
COPY packages/puppeteer/package.json ./packages/puppeteer/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY playwright.config.ts tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY tests ./tests
RUN npm run build
RUN mkdir -p /work/artifacts && chown -R pwuser:pwuser /work
USER pwuser
CMD ["npm", "run", "test:conformance"]
