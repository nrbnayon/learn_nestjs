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
- `otpVerification` boolean, optional. If `true`, registration uses OTP verification instead of email link
- `verificationChannel` string, optional. One of `email` or `phone` (used with `otpVerification=true`)

Example:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "username": "john_doe",
  "password": "StrongPass123!",
  "tenantId": "tenant-uuid",
  "otpVerification": true,
  "verificationChannel": "email"
}
```

Registration response now returns verification instructions (not login tokens) until account verification is complete.

Example success response:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Account created successfully. Check john@example.com for a 6-digit OTP (valid for 5 minutes).",
  "data": {
    "verificationRequired": true,
    "verificationType": "otp",
    "channel": "email",
    "identifier": "john@example.com",
    "expiresIn": 300,
    "verificationToken": "253b75f5f61244e1887f0a95d4115dc4"
  },
  "timestamp": "2026-04-25T08:24:46.795Z"
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

Behavior:
- Sends password-reset OTP to email (non-enumerable response)
- Then call OTP verify with `purpose=password_reset`
- Use the returned `resetToken` with `/auth/reset-password`

### Reset password
```http
POST /auth/reset-password
```

Body:
```json
{
  "token": "reset-token-from-otp-verify",
  "newPassword": "NewPass123!"
}
```

### Verify email
Browser-friendly link:
```http
GET /auth/verify-email?token=email-verification-token
```

Deep-linking to app after verify:
```http
GET /auth/verify-email?token=email-verification-token&platform=app
```

Redirect behavior:
- `platform=web` (default): redirects to `WEB_VERIFY_EMAIL_SUCCESS_URL` or `WEB_VERIFY_EMAIL_FAILURE_URL`
- `platform=app`: redirects to `APP_VERIFY_EMAIL_SUCCESS_URL` or `APP_VERIFY_EMAIL_FAILURE_URL`
- Backend appends query params: `status`, `platform`, and on failure `message`

### Frontend examples

Web email link button:
```tsx
const apiBase = 'http://localhost:3001/api/v1';

export function VerifyEmailButton({ token }: { token: string }) {
  const verifyUrl = `${apiBase}/auth/verify-email?token=${encodeURIComponent(token)}&platform=web`;

  return (
    <a href={verifyUrl} target="_self" rel="noreferrer">
      Verify your email
    </a>
  );
}
```

Web success page:
```tsx
import { useSearchParams } from 'react-router-dom';

export function VerifyEmailSuccessPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const message = searchParams.get('message');

  return (
    <div>
      <h1>{status === 'success' ? 'Email verified' : 'Verification failed'}</h1>
      {message ? <p>{message}</p> : null}
      <a href="/login">Go to login</a>
    </div>
  );
}
```

Mobile deeplink route handler with Expo Router:
```tsx
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect } from 'react';

export default function VerifyEmailRoute() {
  const { token, platform } = useLocalSearchParams<{ token?: string; platform?: string }>();

  useEffect(() => {
    const run = async () => {
      if (!token) return;

      const apiBase = 'http://localhost:3001/api/v1';
      const url = `${apiBase}/auth/verify-email?token=${encodeURIComponent(token)}&platform=${platform === 'app' ? 'app' : 'web'}`;
      const response = await fetch(url, { method: 'GET' });

      if (response.redirected) {
        router.replace(response.url);
        return;
      }

      const text = await response.text();
      console.log(text);
    };

    void run();
  }, [platform, token]);

  return null;
}
```

Mobile app deep link setup example:
```ts
// app.json or app.config.ts
{
  "scheme": "nestjschat"
}
```

Deep link target examples:
- `nestjschat://auth/verify-email/success?status=success&platform=app`
- `nestjschat://auth/verify-email/failure?status=failure&platform=app&message=Invalid%20verification%20token`

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
  "tenantId": "tenant-uuid",
  "purpose": "account_verification"
}
```

Rules:
- `channel` must be `email` or `phone`
- `purpose` supports `login`, `account_verification`, `password_reset` (default: `login`)
- Phone OTP currently returns a dummy `123456`
- Email OTP is stored in Redis with a 5 minute TTL (`password_reset` uses 10 minutes)
- Response includes `verificationToken` (optional but recommended for verify step)
- Resend is limited to 3 requests per OTP window; exceeding this blocks OTP for 6 hours
- Invalid OTP attempts are limited to 3; after that OTP is blocked for 6 hours

### Verify OTP
```http
POST /auth/otp/verify
```

Alias:
```http
POST /auth/verify-otp
```

Body:
```json
{
  "identifier": "john@example.com",
  "otp": "123456",
  "tenantId": "tenant-uuid",
  "purpose": "account_verification",
  "token": "253b75f5f61244e1887f0a95d4115dc4"
}
```

Purpose-specific behavior:
- `purpose=login`: returns `{ user, tokens }`
- `purpose=account_verification`: marks email/phone as verified and returns success message
- `purpose=password_reset`: returns `resetToken` (short-lived) for `/auth/reset-password`

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
