# Authentication Status: Password Login Disabled

**Date Disabled:** September 1, 2026  
**Status:** ⚠️ Password authentication is currently disabled

## What's Disabled

- ❌ Login with email + password
- ❌ Create new accounts with password
- ❌ Password reset / forgot password flows

## What's Still Working

- ✅ JWT token validation (existing sessions)
- ✅ Authenticated page access (if already logged in)
- ✅ Server actions requiring auth

## Why It's Disabled

User requested to disable password authentication while keeping the codebase ready for quick re-enablement.

## Re-Enable Instructions

See: `apps/web/src/lib/auth/_disabled/README.md`

Quick steps:
1. Restore `password.ts` from `_disabled/` folder
2. Uncomment password fields in login-form.tsx and signup-form.tsx
3. Restore password logic in `/login/actions.ts` and `/signup/actions.ts`
4. Run migrations if not already applied
5. Restart dev server

## Files Affected

**Disabled/Modified:**
- `apps/web/src/app/login/login-form.tsx` — shows disabled message
- `apps/web/src/app/signup/signup-form.tsx` — shows disabled message

**Moved to _disabled (Backup):**
- `apps/web/src/lib/auth/_disabled/password.ts` — password hashing/verification
- `apps/web/src/lib/auth/_disabled/jwt.ts` — JWT token handling
- `apps/web/src/lib/auth/_disabled/README.md` — full re-enable guide

**Still Active:**
- `apps/web/src/lib/auth.ts` — session management
- `apps/web/src/lib/auth/jwt.ts` — token operations
- `apps/web/src/proxy.ts` — middleware auth checks

## Testing

To verify disabled state:
1. Open `https://lensello-web-kappa.vercel.app/login`
2. Should see disabled message (not form)
3. Open `https://lensello-web-kappa.vercel.app/signup`
4. Should see disabled message (not form)

## Emergency Re-Enable

If you need to quickly re-enable:

```bash
# Copy files back
cp src/lib/auth/_disabled/password.ts src/lib/auth/
cp src/lib/auth/_disabled/jwt.ts src/lib/auth/

# Restore git changes to forms
git checkout -- apps/web/src/app/login/login-form.tsx
git checkout -- apps/web/src/app/signup/signup-form.tsx

# Restart
npm run dev
```

## Future: Alternative Auth Methods

Consider implementing for long-term:
- OAuth (Google, Apple)
- Magic links / Email verification
- Admin-only invitations
- SAML/SSO integration
