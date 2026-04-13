# NestJS Chat Backend

Scalable real-time chat backend built with NestJS, PostgreSQL, Redis, Prisma, BullMQ, and Socket.IO.

## Architecture

The codebase is intentionally split by responsibility:

- `modules/` holds business modules such as auth and user flows.
- `common/` contains reusable system code like guards, filters, interceptors, pipes, decorators, and constants.
- `config/` centralizes environment-driven configuration and validation.
- `database/` owns Prisma setup and database lifecycle management.
- `redis/`, `queue/`, and `socket/` implement the infrastructure layer for pub/sub, background jobs, and websocket state.

## Key Decisions

- Separation of concerns keeps domain logic isolated from infrastructure.
- Redis Pub/Sub is used to support multi-instance synchronization.
- BullMQ is used for queued background jobs such as email and notification delivery.
- Prisma provides typed access to PostgreSQL.
- DTO validation, guards, filters, and interceptors enforce a clean enterprise-style request pipeline.
- Socket state is managed centrally so online users and open connections stay consistent.

## Technology Stack

- NestJS
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Socket.IO
- JWT authentication
- Class Validator and Class Transformer

## Project Structure

```text
src/
  common/        shared framework code
  config/        configuration loaders and validation
  database/      Prisma module and service
  modules/       domain modules
  queue/         BullMQ queues and processors
  redis/         Redis client and pub/sub subscriber
  shared/        app-wide services
  socket/        websocket state and adapter
```

## Getting Started

```bash
yarn install
```

Create a `.env` file with the database, Redis, JWT, and mail settings used by `src/config/configuration.ts`.

## Run

```bash
# development
yarn start:dev

# production
yarn build
yarn start:prod
```

## Test

```bash
yarn test
yarn test:e2e
yarn test:cov
```

## Useful Scripts

```bash
yarn prisma:generate
yarn prisma:migrate
yarn prisma:studio
yarn prisma:seed
```

## Deployment Notes

When fronting the API with nginx, make sure websocket upgrade headers are forwarded so Socket.IO connections stay stable.
