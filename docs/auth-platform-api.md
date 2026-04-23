# Auth Platform API Guide

Base URL:
- Local: `http://localhost:3001/api/v1`
- Docker: `http://localhost:8080/api/v1`

## 1) Start the API

### Local development
```powershell
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### Docker
```powershell
docker-compose up --build
```

### Verify health
```http
GET /health
```

## 2) Required headers

Use these headers when testing tenant-aware requests:

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>` for protected routes
- `x-tenant-id: <tenantId>` or `x-tenant-domain: <tenantDomain>` for multi-tenant resolution
- `x-user-agent` is not required; the server reads the standard `User-Agent` header

## 3) Auth endpoints

### Register
```http
POST /auth/register
```

Body parameters:
- `fullName` string, required
- `email` string, optional
- `phone` string, optional
- `username` string, optional. Auto-generated from `fullName` when omitted
- `password` string, optional
- `tenantId` string, optional

Example:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "username": "john_doe",
  "password": "StrongPass123!",
  "tenantId": "tenant-uuid"
}
```

### Login
```http
POST /auth/login
```

Body parameters:
- `identifier` string, required. Accepts email, username, or phone
- `password` string, optional. Use for password login
- `otp` string, optional. Use for OTP login
- `provider` string, optional. One of `google`, `github`, `facebook`, `linkedin`

Examples:

Password login:
```json
{
  "identifier": "john@example.com",
  "password": "StrongPass123!"
}
```

OTP login:
```json
{
  "identifier": "john@example.com",
  "otp": "123456"
}
```

OAuth-linked login:
```json
{
  "identifier": "provider-account-id",
  "provider": "google"
}
```

### Refresh token
```http
POST /auth/refresh-token
```

Body:
```json
{
  "refreshToken": "<refreshToken>"
}
```

### Logout
```http
POST /auth/logout
```

Protected with Bearer token.

### Me
```http
GET /auth/me
```

Protected with Bearer token.

### Change password
```http
POST /auth/change-password
```

Protected with Bearer token.

Body:
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

### Forgot password
```http
POST /auth/forgot-password
```

Body:
```json
{
  "email": "john@example.com"
}
```

### Reset password
```http
POST /auth/reset-password
```

Body:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewPass123!"
}
```

### Verify email
Browser-friendly link:
```http
GET /auth/verify-email?token=email-verification-token
```

API fallback:
```http
POST /auth/verify-email
```

Body:
```json
{
  "token": "email-verification-token"
}
```

## 4) OTP endpoints

### Send OTP
```http
POST /auth/otp/send
```

Body:
```json
{
  "identifier": "john@example.com",
  "channel": "email",
  "tenantId": "tenant-uuid"
}
```

Rules:
- `channel` must be `email` or `phone`
- Phone OTP currently returns a dummy `123456`
- Email OTP is stored in Redis with a 5 minute TTL

### Verify OTP
```http
POST /auth/otp/verify
```

Body:
```json
{
  "identifier": "john@example.com",
  "otp": "123456",
  "tenantId": "tenant-uuid"
}
```

## 5) Tenant endpoints

### Create tenant
```http
POST /tenants
```

Body:
```json
{
  "name": "Acme Inc",
  "domain": "acme.example.com"
}
```

### List tenants
```http
GET /tenants
```

## 6) Role and permission management

### Create permission
```http
POST /permissions
```

Body:
```json
{
  "action": "read",
  "subject": "user",
  "description": "Can read user profiles"
}
```

### List permissions
```http
GET /permissions
```

### Create role
```http
POST /roles
```

Body:
```json
{
  "name": "ADMIN",
  "tenantId": "tenant-uuid"
}
```

### List roles
```http
GET /roles
```

### Assign permission to role
```http
POST /roles/:roleId/permissions/:permissionId
```

### Assign role to user
```http
POST /roles/:roleId/users/:userId
```

## 7) Sessions and audit

### List sessions for a user
```http
GET /sessions/users/:userId
```

### Revoke all sessions for a user
```http
DELETE /sessions/users/:userId
```

### List audit logs
```http
GET /audit?limit=50
```

## 8) OAuth connect helper

This backend currently exposes a linkage endpoint for provider accounts:

```http
POST /oauth/connect
```

Body:
```json
{
  "userId": "user-uuid",
  "provider": "google",
  "providerAccountId": "google-subject-id",
  "accessToken": "provider-access-token",
  "refreshToken": "provider-refresh-token"
}
```

## 9) Postman variables

Recommended environment variables:
- `baseUrl` = `http://localhost:3001/api/v1`
- `tenantId` = `<tenant-uuid>`
- `tenantDomain` = `acme.example.com`
- `accessToken` = `<jwt-access-token>`
- `refreshToken` = `<jwt-refresh-token>`
- `userId` = `<user-uuid>`
- `roleId` = `<role-uuid>`
- `permissionId` = `<permission-uuid>`
- `providerAccountId` = `<provider-subject-id>`

## 10) Social login keys and secrets

For backend API testing, no extra API key is required.

For real Google/GitHub/Facebook/LinkedIn login, you will need provider app credentials:
- Google: OAuth client ID and secret
- GitHub: OAuth app client ID and secret
- Facebook: App ID and app secret
- LinkedIn: Client ID and client secret

This service expects the frontend or gateway to complete the provider OAuth flow and then send the verified provider identity to the backend. The `POST /oauth/connect` route is for linking a provider account after verification, not for verifying the provider itself.

## 11) WebSocket auth

Socket handshake requires a JWT access token:
- `handshake.auth.token = <accessToken>`
- or `Authorization: Bearer <accessToken>`

Presence events:
- `user_online`
- `user_offline`

## 12) Testing order

1. Create a tenant
2. Create permissions
3. Create roles
4. Register a user
5. Log in and capture tokens
6. Call protected routes with `Authorization: Bearer <accessToken>`
7. Test OTP send/verify
8. Revoke session and test refresh/logout behavior
