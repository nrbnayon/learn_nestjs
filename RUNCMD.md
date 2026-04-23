# 🚀 How to Run This Project

## Quick Start

```powershell
npm run start:dev
```

### **Option 1: Docker Compose (Recommended) ⭐**

Run the entire stack with one command:

```powershell
docker-compose up --build
```

- Starts PostgreSQL, Redis, and NestJS backend
- Backend runs at `http://localhost:8080`
- Health check: `http://localhost:8080/api/v1/health`

**Useful Docker commands:**

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

# Stop and remove everything
docker-compose down
```

---

### **Option 2: Local Development**

#### Prerequisites
- Node.js v22+
- PostgreSQL 16+
- Redis 7+

#### Setup Steps

1. **Install dependencies:**
   ```powershell
   yarn install
   ```

2. **Setup database (first time only):**
   ```powershell
   yarn prisma migrate dev
   ```

3. **Start development server:**
   ```powershell
   yarn start:dev
   ```

   - Runs with hot reload on `http://localhost:3001`
   - Requires PostgreSQL and Redis running locally

---

## All Available Commands

| Command | Purpose |
|---------|---------|
| `yarn build` | Build for production |
| `yarn start` | Start application |
| `yarn start:dev` | Start with hot reload (development) |
| `yarn start:debug` | Start in debug mode with watch |
| `yarn start:prod` | Run production build |
| `yarn lint` | Run ESLint and fix issues |
| `yarn format` | Format code with Prettier |
| `yarn test` | Run unit tests |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:cov` | Run tests with coverage |
| `yarn test:e2e` | Run end-to-end tests |
| `yarn prisma migrate dev` | Run pending migrations |
| `yarn prisma migrate:prod` | Run migrations in production |
| `yarn prisma studio` | Open Prisma Studio (database GUI) |
| `yarn prisma:seed` | Seed database with initial data |

---

## Environment Configuration

Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3001
APP_HOST=127.0.0.1
APP_BASE_URL=http://localhost:3001

# Database (Local)
DATABASE_URL="postgresql://postgres:1234@localhost:5432/nestjs_chat_db?schema=public"
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=1234
DB_NAME=nestjs_chat_db

# Redis (Local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d
```

**For Docker**, use:
```env
DB_HOST=postgres
REDIS_HOST=redis
```

---

## API Health Check

```bash
curl http://localhost:8080/api/v1/health
```

---

## Troubleshooting

**Port already in use?**
```powershell
# Change PORT in .env or stop the process using that port.
```

**Database connection error?**
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env
- Check credentials match your PostgreSQL setup

**Redis connection error?**
- Ensure Redis is running
- Check REDIS_HOST and REDIS_PORT in .env

**Docker Compose won't start?**
- Ensure Docker Desktop is running
- Run `docker-compose up --build` again
