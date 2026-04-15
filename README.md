# 🚀 NestJS Chat Backend

A modern, scalable real-time chat application backend built with **NestJS**, **TypeScript**, **PostgreSQL**, **Redis**, and **Socket.IO**.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Running the Application](#running-the-application)
- [Docker Commands](#docker-commands)

---

## ✨ Features

- ✅ **Real-time Chat** - Socket.IO for live messaging
- ✅ **User Authentication** - JWT-based auth with refresh tokens
- ✅ **Message Management** - Send, receive, and mark messages as read
- ✅ **WebSocket Support** - Real-time notifications and chat updates
- ✅ **Redis Caching** - In-memory data store for performance
- ✅ **Job Queue** - BullMQ for async tasks (emails, notifications)
- ✅ **File Upload** - Support for file uploads (local/S3)
- ✅ **CORS Security** - Configurable CORS policies

---

## 📦 Prerequisites

- **Docker & Docker Compose** (for containerized setup) - Recommended ⭐
- **PostgreSQL 16+** (local or via Docker)
- **Redis 7+** (local or via Docker)
- **Node.js v22+** (for local development)
- **Git**

---

## 🚀 Running the Application

### **Option 1: Docker Compose (Recommended)** ⭐

Run the entire stack with one command:

```powershell
# Start all services (PostgreSQL, Redis, NestJS)
docker-compose up --build

# View logs in another terminal
docker-compose logs -f app

# Stop everything
docker-compose down
```

**That's it!** Your backend is running at `http://localhost:3000/api/v1/health`

#### Useful Docker Commands

```powershell
# View service status
docker-compose ps

# View logs for specific service
docker-compose logs app       # Backend logs
docker-compose logs postgres  # Database logs
docker-compose logs redis     # Redis logs

# Run database migrations inside Docker
docker-compose exec app yarn prisma migrate dev

# Access PostgreSQL shell inside Docker
docker-compose exec postgres psql -U postgres -d nestjs_chat_db

# Stop and remove everything (including data)
docker-compose down -v
```

---

### **Option 2: Local Development**

#### Windows Setup

1. **Install PostgreSQL**
   - Download: https://www.postgresql.org/download/windows/
   - Remember the password for `postgres` user
   - Default port: 5432

2. **Install Redis**
   - Option A: WSL (Windows Subsystem for Linux)
   - Option B: Download: https://github.com/microsoftarchive/redis/releases

3. **Update `.env`**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/nestjs_chat_db?schema=public"
   DB_HOST=localhost
   REDIS_HOST=localhost
   ```

4. **Start the app**
   ```powershell
   yarn install
   yarn prisma migrate dev
   yarn start:dev
   ```

#### macOS Setup

```bash
# Install PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# Install Redis
brew install redis
brew services start redis

# Start NestJS
yarn install
yarn prisma migrate dev
yarn start:dev
```

#### Linux Setup

```bash
# Install PostgreSQL
sudo apt-get install postgresql-16
sudo systemctl start postgresql

# Install Redis
sudo apt-get install redis-server
sudo systemctl start redis-server

# Start NestJS
yarn install
yarn prisma migrate dev
yarn start:dev
```

---

## ⚙️ Environment Configuration (.env)

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://postgres:1234@localhost:5432/nestjs_chat_db?schema=public"
DB_HOST=localhost      # Use "postgres" for Docker
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=1234
DB_NAME=nestjs_chat_db

# Redis
REDIS_HOST=localhost   # Use "redis" for Docker
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d
```

---

## 🔌 API Endpoints

Base URL: `http://localhost:3000/api/v1/`

```
Auth:
  POST   /auth/register
  POST   /auth/login
  POST   /auth/logout

Users:
  GET    /users
  GET    /users/:id
  GET    /users/me
  PATCH  /users/me

Conversations:
  GET    /conversations
  GET    /conversations/:id
  POST   /conversations

Messages:
  GET    /messages/:roomId
  POST   /messages/send
  POST   /messages/read

Health:
  GET    /health
```

---

## 🐛 Troubleshooting

### Docker Issues

**"Cannot reach database server at localhost:5432"**
```
→ When using Docker, use "postgres" not "localhost"
→ Docker Compose handles this automatically
→ Check: docker-compose.yml environment variables
```

**"Port 3000 already in use"**
```powershell
docker-compose down
# or change port in docker-compose.yml
```

**Containers keep restarting**
```powershell
docker-compose logs app  # Check the error
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Local Development Issues

**PostgreSQL connection failed**
```powershell
# Verify PostgreSQL is running
psql -U postgres -d nestjs_chat_db

# Create database if missing
psql -U postgres -c "CREATE DATABASE nestjs_chat_db;"
```

**Redis connection failed**
```powershell
# Verify Redis is running
redis-cli ping  # Should return "PONG"
```

---

## 📁 Project Architecture

```
src/
├── modules/          # Feature modules (auth, user, chat, etc.)
├── common/           # Guards, interceptors, decorators, filters
├── config/           # Configuration loaders and validation
├── database/         # Prisma module and service
├── redis/            # Redis client and pub/sub
├── queue/            # BullMQ job processors
├── shared/           # JWT, logger, mail, storage services
└── socket/           # WebSocket state and adapter
```

---

## 💻 Development Scripts

```powershell
yarn start:dev           # Development (hot reload)
yarn build               # Compile TypeScript
yarn start:prod          # Production
yarn test                # Run tests
yarn test:e2e            # E2E tests
yarn prisma migrate dev  # Database migrations
yarn prisma generate     # Generate Prisma client
yarn lint                # ESLint check
yarn format              # Format code
```

---

## 🔐 Security Notes

- Generate strong JWT secrets (min 32 chars)

---

## 📚 Resources

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [Redis Docs](https://redis.io/docs/)

---

**Happy Coding! 🎉**
