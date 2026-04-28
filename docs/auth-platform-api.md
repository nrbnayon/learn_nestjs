# Auth Platform API Guide

Base URL:
- Local: `http://localhost:3001/api/v1`
- Docker: `http://localhost:8080/api/v1`

## Table of Contents
1. [Getting Started](#getting-started)
2. [Required Headers](#required-headers)
3. [Auth Endpoints](#auth-endpoints)
4. [OTP Endpoints](#otp-endpoints)
5. [User Endpoints](#user-endpoints)
6. [Presence Endpoints](#presence-endpoints)
7. [OAuth Endpoints](#oauth-endpoints)
8. [Tenant Endpoints](#tenant-endpoints)
9. [RBAC: Permissions and Roles](#rbac-permissions-and-roles)
10. [Sessions & Audit](#sessions--audit)
11. [WebSocket Auth](#websocket-auth)
12. [Testing Order](#testing-order)

## Getting Started

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

## Required Headers

Use these headers when testing requests:

- `Content-Type: application/json` (for POST/PATCH requests)
- `Authorization: Bearer <accessToken>` (for protected routes marked with 🔒)
- `x-tenant-id: <tenantId>` (optional, for multi-tenant resolution)
- `x-tenant-domain: <tenantDomain>` (optional, for multi-tenant resolution)

---

## Auth Endpoints

### Register
```http
POST /auth/register
```

**Parameters:**
- `fullName` (string, required): User's full name (2-80 chars)
- `email` (string, optional): User's email address
- `phone` (string, optional): User's phone number
- `username` (string, optional): Unique username (3-30 chars, alphanum + underscore)
- `password` (string, optional): Password (8+ chars, must contain uppercase, lowercase, number)
- `tenantId` (string, optional): Tenant UUID
- `otpVerification` (boolean, optional): Use OTP for verification instead of email link
- `verificationChannel` (string, optional): `email` or `phone` (used with `otpVerification=true`)

**Request:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "username": "john_doe",
  "password": "SecurePass123!",
  "otpVerification": false,
  "verificationChannel": "email"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful. Check your email for verification.",
  "data": {
    "verificationRequired": true,
    "verificationType": "email_link",
    "channel": "email",
    "identifier": "john@example.com",
    "verificationToken": "f83dfee2d12b47bd9bd9957efb02cfa1"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Login
```http
POST /auth/login
```

**Parameters:**
- `identifier` (string, required): Email, username, or phone number
- `password` (string, optional): Required for password login
- `otp` (string, optional): Required for OTP login (6 digits)
- `provider` (string, optional): `google`, `github`, `facebook`, or `linkedin`

**Password Login:**
```json
{
  "identifier": "john@example.com",
  "password": "SecurePass123!"
}
```

**OTP Login:**
```json
{
  "identifier": "john@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "username": "john_doe",
      "role": "user"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800
    }
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Get Profile (Auth) 🔒
```http
GET /auth/me
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "user-uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "username": "john_doe",
    "emailVerified": true,
    "phoneVerified": false,
    "createdAt": "2026-04-28T10:15:28.656Z"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Change Password 🔒
```http
POST /auth/change-password
Authorization: Bearer <accessToken>
```

**Parameters:**
- `currentPassword` (string, required): Current password
- `newPassword` (string, required): New password (8+ chars, uppercase + lowercase + number)

**Request:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Forgot Password
```http
POST /auth/forgot-password
```

**Parameters:**
- `email` (string, required): Email address
- `otpVerification` (boolean, optional): Use OTP instead of email link

**Request:**
```json
{
  "email": "john@example.com",
  "otpVerification": false
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "If the account exists, a password reset link has been sent",
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Reset Password
```http
POST /auth/reset-password
```

**Parameters:**
- `token` (string, required): Password reset token from email or OTP verification
- `newPassword` (string, required): New password

**Request:**
```json
{
  "token": "reset-token-from-otp-verify",
  "newPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset successfully. Now you can login.",
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Verify Email (GET Link)
```http
GET /auth/verify-email?token=<token>&platform=web
```

**Query Parameters:**
- `token` (string, required): Email verification token
- `platform` (string, optional): `web` or `app` (default: `web`)

**Redirect Behavior:**
- `platform=web`: Redirects to `WEB_VERIFY_EMAIL_SUCCESS_URL` or `WEB_VERIFY_EMAIL_FAILURE_URL`
- `platform=app`: Redirects to `APP_VERIFY_EMAIL_SUCCESS_URL` or `APP_VERIFY_EMAIL_FAILURE_URL`
- Appends query params: `status`, `platform`, and `message` on failure

---

### Verify Email (POST) 
```http
POST /auth/verify-email
```

**Parameters:**
- `token` (string, required): Email verification token

**Request:**
```json
{
  "token": "email-verification-token"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Refresh Token
```http
POST /auth/refresh-token
```

**Parameters:**
- `refreshToken` (string, required): Valid refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 604800
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Logout 🔒
```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully. Your session has been terminated.",
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## OTP Endpoints

### Send OTP
```http
POST /auth/otp/send
```

**Parameters:**
- `identifier` (string, required): Email or phone number
- `channel` (string, optional): `email` or `phone` (auto-detected if omitted)
- `tenantId` (string, optional): Tenant UUID
- `purpose` (string, optional): `login`, `account_verification`, or `password_reset` (auto-detected if omitted)

**Request (Minimal):**
```json
{
  "identifier": "john@example.com"
}
```

**Request (Full):**
```json
{
  "identifier": "john@example.com",
  "channel": "email",
  "tenantId": "tenant-uuid",
  "purpose": "account_verification"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "OTP sent successfully via email.",
  "data": {
    "channel": "email",
    "purpose": "account_verification",
    "expiresIn": 300,
    "verificationToken": "1996a96d56e64214b948c181f8100689"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

**Rules:**
- `identifier` is required
- `channel` is optional. Backend auto-detects from identifier/account:
  - Email-like identifier (`user@example.com`) → `email`
  - Phone-like identifier (`+15551234567`) → `phone`
  - Username → backend chooses available channel from account
- `purpose` is optional. Backend auto-detects:
  - Unverified account → `account_verification`
  - Otherwise → `login`
- Phone OTP returns dummy code `123456`
- Email OTP stored in Redis with 5-minute TTL (`password_reset` uses 10 minutes)
- Resend limited to 3 requests; exceeding blocks OTP for 6 hours
- Invalid OTP attempts limited to 3; blocks for 6 hours after

---

### Verify OTP
```http
POST /auth/otp/verify
```

Alias: `POST /auth/verify-otp`

**Parameters:**
- `identifier` (string, required): Email or phone number
- `otp` (string, required): 6-digit OTP code
- `tenantId` (string, optional): Tenant UUID
- `purpose` (string, optional): `login`, `account_verification`, or `password_reset`
- `token` (string, optional): Verification token from `/auth/otp/send`

**Request:**
```json
{
  "identifier": "john@example.com",
  "otp": "123456",
  "token": "253b75f5f61244e1887f0a95d4115dc4",
  "purpose": "account_verification"
}
```

**Purpose-specific responses:**

**For `purpose=login`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OTP verified successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "John Doe",
      "email": "john@example.com"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800
    }
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

**For `purpose=account_verification`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

**For `purpose=password_reset`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OTP verified successfully",
  "data": {
    "resetToken": "short-lived-reset-token"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## User Endpoints

### Get Profile (Users/Me) 🔒
```http
GET /users/me
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "user-uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "username": "john_doe",
    "phone": "+15551234567",
    "avatar": "https://example.com/avatar.jpg",
    "emailVerified": true,
    "phoneVerified": false,
    "createdAt": "2026-04-28T10:15:28.656Z"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Update Profile (Me) 🔒
```http
PATCH /users/me
Authorization: Bearer <accessToken>
```

**Parameters:**
- `fullName` (string, optional): New full name
- `phone` (string, optional): New phone number
- `avatar` (string, optional): Avatar URL

**Request:**
```json
{
  "fullName": "John Updated",
  "phone": "+15551234567"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile updated successfully",
  "data": {
    "id": "user-uuid",
    "fullName": "John Updated",
    "email": "john@example.com",
    "phone": "+15551234567"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### List Users 🔒
```http
GET /users?search=john
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `search` (string, optional): Search by name, email, or username

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "user-uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "username": "john_doe"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Get User by ID 🔒
```http
GET /users/:id
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "user-uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "username": "john_doe"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## Presence Endpoints

### Get My Presence 🔒
```http
GET /users/presence/me
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "user-uuid",
    "status": "online",
    "lastSeen": "2026-04-28T10:15:28.656Z"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Get Friends Presence 🔒
```http
GET /users/presence/friends?search=&limit=50
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `search` (string, optional): Search friends by name
- `limit` (string, optional): Result limit (default: 50)

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "userId": "friend-uuid",
      "fullName": "Jane Smith",
      "status": "online",
      "lastSeen": "2026-04-28T10:15:28.656Z"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Get Active Users 🔒
```http
GET /users/presence/active?search=&limit=50
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `search` (string, optional): Search users by name
- `limit` (string, optional): Result limit

**Note:** Admin users see all active users; regular users see only friends.

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "userId": "user-uuid",
      "fullName": "Jane Smith",
      "status": "online",
      "lastSeen": "2026-04-28T10:15:28.656Z"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Get User Presence 🔒
```http
GET /users/presence/:id
Authorization: Bearer <accessToken>
```

**Note:** Access control: only yourself, friends, or admins can view presence.

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "target-uuid",
    "fullName": "Jane Smith",
    "status": "online",
    "lastSeen": "2026-04-28T10:15:28.656Z"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## OAuth Endpoints

### OAuth Code Exchange (Backend-to-Backend) 
```http
POST /oauth/google/callback
```

**Purpose**: Exchange Google authorization code for tokens. Call this from your backend after user grants permission.

**Parameters:**
- `code` (string, required): Authorization code from Google OAuth consent screen
- `redirectUri` (string, required): Must match the redirect URI registered in Google Cloud Console

**Request:**
```json
{
  "code": "4/0AY0e-g7...",
  "redirectUri": "http://localhost:3001/auth/google/callback"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Google token exchange successful",
  "data": {
    "accessToken": "ya29.a0AfH6SMBx...",
    "refreshToken": "1//0gF...",
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
    "expiresIn": 3599
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

**Flow Diagram:**
```
1. Frontend redirects user to Google login page
   └─ https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...

2. User grants permission, Google redirects to your app with code
   └─ http://localhost:3001/auth/google/callback?code=4/0AY0e-g7...

3. Frontend sends code to backend
   └─ POST /oauth/google/callback { code, redirectUri }

4. Backend exchanges code for tokens
   └─ Response includes accessToken, idToken, refreshToken

5. Frontend sends idToken to login endpoint
   └─ POST /oauth/google { idToken, accessToken, refreshToken }
```

---

### Login with Google
```http
POST /oauth/google
```

**Purpose**: Create or authenticate user with Google OAuth. Frontend sends pre-obtained tokens from Google.

**Parameters:**
- `idToken` (string, required): Google ID token from frontend authentication
- `accessToken` (string, optional): Google access token for API calls
- `refreshToken` (string, optional): Google refresh token for token refresh
- `tenantId` (string, optional): Tenant UUID

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
  "accessToken": "ya29.a0AfH6SMBx...",
  "refreshToken": "1//0gF...",
  "tenantId": "optional-tenant-uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Google login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "username": "john_doe"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800
    }
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

**Behavior:**
- If user doesn't exist, creates new account with Google profile data
- If email already exists, links Google account to existing user
- Returns JWT tokens for your API authentication

---

### Connect Provider Account 🔒
```http
POST /oauth/connect
Authorization: Bearer <accessToken>
```

**Purpose**: Link an additional OAuth provider to an existing user account.

**Parameters:**
- `provider` (string, required): `google`, `github`, `facebook`, or `linkedin`
- `idToken` (string, optional): Provider's ID token
- `accessToken` (string, optional): Provider's access token
- `refreshToken` (string, optional): Provider's refresh token
- `providerAccountId` (string, optional): Provider's unique account ID

**Request:**
```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
  "accessToken": "ya29.a0AfH6SMBx...",
  "refreshToken": "1//0gF..."
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Provider account connected successfully",
  "data": {
    "provider": "google",
    "providerAccountId": "118364928374629384756",
    "linkedAt": "2026-04-28T10:15:28.656Z"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## Google OAuth Setup (Frontend Guide)

### Install Google Auth Library
```bash
npm install @react-oauth/google
# or for web only
npm install @google/identity-services
```

### React Example
```tsx
import { GoogleLogin } from '@react-oauth/google';

export function LoginComponent() {
  const handleGoogleSuccess = async (credentialResponse) => {
    const idToken = credentialResponse.credential;
    
    // Send to backend OAuth endpoint
    const response = await fetch('http://localhost:3001/api/v1/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('accessToken', result.data.tokens.accessToken);
      localStorage.setItem('refreshToken', result.data.tokens.refreshToken);
      // Redirect to dashboard
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleGoogleSuccess}
      onError={() => console.log('Login Failed')}
    />
  );
}
```

### Backend Code Exchange (Node.js)
```javascript
async function loginWithGoogle(code, redirectUri) {
  // Exchange code for tokens
  const tokenResponse = await fetch('http://localhost:3001/api/v1/oauth/google/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  const { data } = await tokenResponse.json();
  
  // Now use idToken to login
  const loginResponse = await fetch('http://localhost:3001/api/v1/oauth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: data.idToken }),
  });

  return loginResponse.json();
}
```

---

## Tenant Endpoints

### Create Tenant
```http
POST /tenants
```

**Parameters:**
- `name` (string, required): Tenant name
- `domain` (string, optional): Tenant domain

**Request:**
```json
{
  "name": "Acme Inc",
  "domain": "acme.example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "tenant-uuid",
    "name": "Acme Inc",
    "domain": "acme.example.com"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### List Tenants
```http
GET /tenants
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "tenant-uuid",
      "name": "Acme Inc",
      "domain": "acme.example.com"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## RBAC: Permissions and Roles

### Create Permission 🔒
```http
POST /permissions
Authorization: Bearer <accessToken>
```

**Parameters:**
- `action` (string, required): Action name (e.g., `read`, `write`, `delete`)
- `subject` (string, required): Resource subject (e.g., `user`, `post`, `chat`)
- `description` (string, optional): Permission description

**Request:**
```json
{
  "action": "read",
  "subject": "user",
  "description": "Can read user profiles"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "permission-uuid",
    "action": "read",
    "subject": "user",
    "description": "Can read user profiles"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### List Permissions 🔒
```http
GET /permissions
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "permission-uuid",
      "action": "read",
      "subject": "user"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Create Role 🔒
```http
POST /roles
Authorization: Bearer <accessToken>
```

**Parameters:**
- `name` (string, required): Role name (e.g., `ADMIN`, `MODERATOR`, `USER`)
- `tenantId` (string, optional): Tenant UUID

**Request:**
```json
{
  "name": "ADMIN",
  "tenantId": "tenant-uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "role-uuid",
    "name": "ADMIN",
    "tenantId": "tenant-uuid"
  },
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### List Roles 🔒
```http
GET /roles
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "role-uuid",
      "name": "ADMIN",
      "tenantId": "tenant-uuid"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Assign Permission to Role 🔒
```http
POST /roles/:roleId/permissions/:permissionId
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Permission assigned to role successfully"
}
```

---

### Assign Role to User 🔒
```http
POST /roles/:roleId/users/:userId
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Role assigned to user successfully"
}
```

---

## Sessions & Audit

### List User Sessions 🔒
```http
GET /sessions/users/:userId
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "session-uuid",
      "userId": "user-uuid",
      "accessToken": "token-hash",
      "userAgent": "Mozilla/5.0...",
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-04-28T10:15:28.656Z",
      "expiresAt": "2026-05-05T10:15:28.656Z"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

### Revoke All User Sessions 🔒
```http
DELETE /sessions/users/:userId
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All sessions revoked successfully"
}
```

---

### List Audit Logs 🔒
```http
GET /audit?limit=50&offset=0
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `limit` (string, optional): Result limit (default: 50)
- `offset` (string, optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "audit-uuid",
      "userId": "user-uuid",
      "action": "LOGIN",
      "resource": "AUTH",
      "status": "SUCCESS",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-04-28T10:15:28.656Z"
    }
  ],
  "timestamp": "2026-04-28T10:15:28.656Z"
}
```

---

## WebSocket Auth

Socket handshake requires a JWT access token:

```javascript
// Connection options
const socket = io('http://localhost:3001', {
  auth: {
    token: accessToken  // Send as 'token' in auth object
  }
  // OR use Authorization header
  extraHeaders: {
    Authorization: `Bearer ${accessToken}`
  }
});

// Listen for presence events
socket.on('user_online', (data) => {
  console.log('User online:', data);
});

socket.on('user_offline', (data) => {
  console.log('User offline:', data);
});
```

---

## Testing Order

Follow this sequence for comprehensive testing:

1. **Health Check**
   ```http
   GET /health
   ```

2. **Create Tenant**
   ```http
   POST /tenants
   ```

3. **Register User**
   ```http
   POST /auth/register
   ```

4. **Send OTP (if using OTP verification)**
   ```http
   POST /auth/otp/send
   ```

5. **Verify OTP**
   ```http
   POST /auth/otp/verify
   ```

6. **Login**
   ```http
   POST /auth/login
   ```
   Save `accessToken` and `refreshToken`

7. **Create Permissions**
   ```http
   POST /permissions
   ```

8. **Create Roles**
   ```http
   POST /roles
   ```

9. **Assign Permission to Role**
   ```http
   POST /roles/:roleId/permissions/:permissionId
   ```

10. **Assign Role to User**
    ```http
    POST /roles/:roleId/users/:userId
    ```

11. **Get Profile**
    ```http
    GET /auth/me
    Authorization: Bearer <accessToken>
    ```

12. **List Sessions**
    ```http
    GET /sessions/users/:userId
    Authorization: Bearer <accessToken>
    ```

13. **List Audit Logs**
    ```http
    GET /audit
    Authorization: Bearer <accessToken>
    ```

14. **Test OAuth (Google)**
    ```http
    POST /oauth/google
    ```

15. **Connect Provider (Optional)**
    ```http
    POST /oauth/connect
    Authorization: Bearer <accessToken>
    ```

16. **Logout**
    ```http
    POST /auth/logout
    Authorization: Bearer <accessToken>
    ```

---

## Environment Variables

Store these in `.env` for local testing:

```
NODE_ENV=development
PORT=3001
APP_NAME=NestJS Chat Backend
APP_BASE_URL=http://localhost:3001

DATABASE_URL=postgresql://postgres:password@localhost:5432/nestjs_chat_db
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_REFRESH_EXPIRES_IN=30d

REDIS_HOST=localhost
REDIS_PORT=6379

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## Key Implementation Notes

1. **Multi-tenant Support**: Use `x-tenant-id` or `x-tenant-domain` headers for tenant resolution
2. **OTP Handling**: Phone OTPs return dummy code for testing
3. **Email Verification**: Supports both link-based and OTP-based verification
4. **Session Management**: Each login creates a new session with TTL
5. **Presence Tracking**: Real-time via WebSocket, REST endpoints for current status
6. **RBAC**: Role-Based Access Control with granular permissions
7. **Audit Trail**: All actions logged with user, IP, and user agent
8. **OAuth Integration**: Google, GitHub, Facebook, LinkedIn support
