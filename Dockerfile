FROM node:18.18.0-alpine AS base

FROM base as builder

WORKDIR /app

COPY scripts/ /app/scripts
COPY src/ /app/src
COPY esbuild-hook.js \
  package.json \
  package-lock.json \
  tsconfig.json \
  /app/

RUN npm install
RUN npm run build:main
RUN rm -rf node_modules/ scripts/ src/ esbuild-hook.js tsconfig.json package-lock.json

FROM builder as runtime

WORKDIR /app
ENV NODE_ENV production
CMD [ "npm", "run", "start" ]
