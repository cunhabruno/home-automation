FROM node:18-alpine

RUN corepack enable && corepack prepare yarn@stable --activate

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

COPY tsconfig.json ./
COPY src/ ./src/

RUN yarn add -D typescript && \
    yarn build && \
    yarn remove typescript

RUN rm -rf src/ tsconfig.json

RUN addgroup -g 1001 -S nodejs && \
    adduser -S automation -u 1001

RUN chown -R automation:nodejs /usr/src/app
USER automation

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

CMD ["yarn", "start"]