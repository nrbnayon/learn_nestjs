FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json ./
RUN yarn install

COPY . .
RUN yarn prisma:generate
RUN yarn build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY package.json ./
RUN yarn install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "dist/main"]
