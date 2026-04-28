import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(8080),
  APP_NAME: Joi.string().default('NestJS Chat Backend'),
  APP_HOST: Joi.string().default('127.0.0.1'),
  API_PREFIX: Joi.string().default('api/v1'),
  APP_BASE_URL: Joi.string().uri().default('http://localhost:3001'),
  WEB_VERIFY_EMAIL_SUCCESS_URL: Joi.string().optional(),
  WEB_VERIFY_EMAIL_FAILURE_URL: Joi.string().optional(),
  APP_VERIFY_EMAIL_SUCCESS_URL: Joi.string().optional(),
  APP_VERIFY_EMAIL_FAILURE_URL: Joi.string().optional(),

  // Database
  DATABASE_URL: Joi.string().required(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().default('postgres'),
  DB_NAME: Joi.string().default('nestjs_chat_db'),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(3600),

  // Mail
  MAIL_HOST: Joi.string().default('smtp.gmail.com'),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().email().optional(),
  MAIL_PASSWORD: Joi.string().optional(),
  MAIL_FROM: Joi.string().optional(),
  MAIL_SECURE: Joi.boolean().default(false),

  // Storage
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_FILE_SIZE: Joi.number().default(10485760),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_S3_BUCKET: Joi.string().allow('').optional(),

  // Queue
  QUEUE_REDIS_HOST: Joi.string().default('localhost'),
  QUEUE_REDIS_PORT: Joi.number().default(6379),
  QUEUE_REDIS_PASSWORD: Joi.string().allow('').optional(),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  // Throttle
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Socket
  SOCKET_CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  // OAuth
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),

  // Seed admin
  ADMIN_NAME: Joi.string().optional(),
  ADMIN_EMAIL: Joi.string().email().optional(),
  ADMIN_PASSWORD: Joi.string().min(8).optional(),
});
