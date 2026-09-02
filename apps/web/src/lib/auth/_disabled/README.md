# Disabled Authentication Features

This folder contains authentication features that have been temporarily disabled.

## Currently Disabled

### Password-Based Authentication
- **Files:**
  - `password.ts` — bcryptjs password hashing/verification
  - `jwt.ts` — JWT token generation and validation

- **Status:** Disabled as of Sept 1, 2026

- **Why Disabled:** User requested to disable password login while keeping it available for re-enabling

## How to Re-Enable Password Auth

### 1. Restore Password Login in Login Page

**File:** `apps/web/src/app/login/page.tsx`

Replace:
```tsx
<p className="text-sm text-muted text-center">Password authentication temporarily disabled</p>
```

With the original password form fields (see git history)

### 2. Restore Login Action

**File:** `apps/web/src/app/login/actions.ts`

Uncomment the password verification logic:

```typescript
// RESTORE: Password verification
import { verifyPassword } from '@/lib/auth/password';

// In signIn action:
const passwordMatch = await verifyPassword(parsed.data.password, user.password_hash);
if (!passwordMatch) {
  return { error: 'That email and password combination did not work.' };
}
```

### 3. Restore Signup

**File:** `apps/web/src/app/signup/page.tsx` & `apps/web/src/app/signup/actions.ts`

Uncomment password field in form and password hashing in action:

```typescript
// RESTORE: Password hashing
import { hashPassword } from '@/lib/auth/password';

const passwordHash = await hashPassword(parsed.data.password);
```

### 4. Move Files Back

```bash
# Move password auth back to active
mv src/lib/auth/_disabled/password.ts src/lib/auth/
mv src/lib/auth/_disabled/jwt.ts src/lib/auth/
```

### 5. Re-Enable in Environment

Ensure `.env.local` has:
```
JWT_SECRET="your-secret-key"
LENSELLO_ENCRYPTION_KEY="your-encryption-key"
```

### 6. Test

- Run `npm run dev`
- Try signup with email/password
- Try login with email/password
- Verify JWT tokens are issued

## Current Alternative Login Methods

While password auth is disabled, use:
- OAuth (Google, Apple) — if configured
- Magic link / email verification — if implemented
- Admin invite tokens — if implemented

## Git History

To see the original password auth implementation:
```bash
git log --oneline -- apps/web/src/app/login/ apps/web/src/app/signup/
```

## Questions?

Refer to the original JWT auth implementation in:
- `apps/web/src/lib/auth/jwt.ts` (backup in `_disabled/`)
- `apps/web/src/lib/auth.ts` — main auth utilities
