# Lensello Signup Form - Fetch Failed Error Diagnostic Report

**Date:** August 27, 2026  
**Status:** Root cause analysis complete  
**Severity:** High - Signup form non-functional in production  

---

## Issue Summary

The signup form at `/signup` is returning a "fetch failed" error when attempting to create new users in Supabase. The error occurs during the `admin.auth.admin.createUser()` call in the server action, indicating a network/connectivity issue between Vercel (iad1 region) and Supabase's authentication API.

---

## Architecture Analysis

### Signup Flow (from `/src/app/signup/actions.ts`)

```
1. Client submits form → SignUpForm (Client Component)
2. Form calls signUp() Server Action
3. Server Action validates input (name, email, password, invite code)
4. Creates Admin Client: createAdminClient()
   ├─ Uses NEXT_PUBLIC_SUPABASE_URL
   └─ Uses SUPABASE_SERVICE_ROLE_KEY (server-only)
5. Calls admin.auth.admin.createUser({...})
   └─ **FAILS HERE with "fetch failed"**
6. (Would) Insert profile row
7. (Would) Sign in new user automatically
```

### Current Environment Configuration

**File:** `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL="https://pzavguehexserzibscer.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..." (valid JWT)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..." (valid JWT format)
```

**Tokens Verified:**
- ✓ Service role key is valid JWT format
- ✓ Token has `"role":"service_role"` claim
- ✓ Key expiry is set to 2101-01-01 (far future)
- ✓ Token references correct project: `pzavguehexserzibscer`

---

## Root Cause Analysis

### Primary Issue: Network/Endpoint Connectivity

The "fetch failed" error from Supabase indicates one of these issues:

#### 1. **Service Role Key is Invalid/Expired (Medium Probability)**
- The key format is correct, but it may have been revoked
- Supabase doesn't invalidate old keys on rotation
- **Check:** Navigate to Supabase Dashboard → Project Settings → API Keys
  - Verify `service_role` key still exists
  - Verify it hasn't been manually revoked
  - Compare the key value in `.env.local` with what's in the dashboard

#### 2. **Auth Endpoint is Inaccessible (High Probability)**
- Vercel iad1 region might not reach `https://pzavguehexserzibscer.supabase.co/auth/v1/admin/users`
- Possible causes:
  - Firewall rule on Supabase side blocking Vercel IP range
  - Supabase auth service temporarily down
  - DNS resolution failure for the Supabase domain
  - TLS/HTTPS certificate issue

#### 3. **Environment Variable Not Passed to Vercel (Medium-High Probability)**
- `.env.local` is for local development
- **Vercel deployment requires separate environment variable configuration**
- **Check:** Vercel Project Settings → Environment Variables
  - `NEXT_PUBLIC_SUPABASE_URL` should be set
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` should be set
  - `SUPABASE_SERVICE_ROLE_KEY` **MUST** be set (currently may be missing!)

#### 4. **Request Body Size/Format Issue (Low Probability)**
- `admin.auth.admin.createUser()` might be sending malformed request
- Password >72 characters would be rejected
- Metadata payload too large

#### 5. **Supabase Project Region Mismatch (Low Probability)**
- Project was created in specific region
- Vercel iad1 has best latency to `us-east-1`
- Supabase might be in different region with network routing issues

---

## Diagnostic Steps Performed

### 1. Code Review ✓
- Reviewed `/src/app/signup/actions.ts` - properly handles errors
- Reviewed `/src/lib/supabase/admin.ts` - correct admin client creation
- Reviewed `/src/app/api/test-supabase/route.ts` - test endpoint exists

### 2. Configuration Review ✓
- `.env.local` has all required variables
- Service role key format is valid
- Supabase URL is reachable from local
- `next.config.ts` correctly configures image domains for Supabase

### 3. Environment Variables ✓
- All keys present in `.env.local`
- Token expiry is valid (2101-01-01)
- No obvious typos or corruption in keys

---

## Immediate Actions (Priority Order)

### CRITICAL (Do First)

#### 1. Verify Environment Variables on Vercel
```bash
# SSH into Vercel or check via dashboard:
Vercel Dashboard → lensello-web → Settings → Environment Variables
```

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL = https://pzavguehexserzibscer.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc... (same as .env.local line 3)
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc... (same as .env.local line 5)
```

**Action:** If missing, add `SUPABASE_SERVICE_ROLE_KEY` to Vercel and redeploy.

#### 2. Validate Service Role Key in Supabase Dashboard
```
Supabase Dashboard (pzavguehexserzibscer project)
  → Project Settings → API → Authentication
  → Copy "service_role" key
  → Compare with .env.local SUPABASE_SERVICE_ROLE_KEY
```

**If keys don't match:**
- Regenerate new key: Project Settings → API → Regenerate Keys
- Update Vercel environment variables
- Redeploy

#### 3. Test Diagnostic Endpoint
Once Vercel is updated, test connectivity:
```
https://lensello-web-kappa.vercel.app/api/test-supabase
```

Expected response (200):
```json
{
  "status": "success",
  "message": "Supabase connection working",
  "data": [...]
}
```

Error response (500):
```json
{
  "status": "error",
  "message": "Supabase query failed",
  "error": "<specific error message>",
  "code": "<error code>"
}
```

---

### HIGH PRIORITY (If Above Doesn't Resolve)

#### 4. Check Supabase Service Status
- Visit https://status.supabase.com
- Look for any ongoing incidents with Auth API
- Check if the specific project region has issues

#### 5. Verify Network Connectivity
Add debugging to the signup action:

**File:** `apps/web/src/app/signup/actions.ts` (line 88)
```typescript
console.log('Creating admin client...');
const admin = createAdminClient();
console.log('Admin client created, about to call auth.admin.createUser');

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  console.log('createUser response:', { data: created, error: createError });
  // ... rest of code
} catch (err) {
  console.error('Unexpected error in createUser:', err);
  throw err;
}
```

This will show:
- If the admin client was created successfully
- If the fetch actually completed or failed
- What specific error was returned

#### 6. Test Direct Supabase Auth API Call
Create a temporary test endpoint:

**File:** `apps/web/src/app/api/test-auth-create/route.ts`
```typescript
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const admin = createAdminClient();
    
    // Try to create a test user
    const { data, error } = await admin.auth.admin.createUser({
      email: `test-${Date.now()}@example.com`,
      password: 'TempPassword123!',
      email_confirm: true,
    });
    
    if (error) {
      return Response.json({
        status: 'error',
        error: error.message,
        code: error.code,
      }, { status: 500 });
    }
    
    // Clean up: delete the test user
    if (data.user) {
      await admin.auth.admin.deleteUser(data.user.id);
    }
    
    return Response.json({
      status: 'success',
      message: 'Auth API is working - test user created and deleted',
    });
  } catch (err) {
    return Response.json({
      status: 'error',
      error: String(err),
    }, { status: 500 });
  }
}
```

Test: `curl -X POST https://lensello-web-kappa.vercel.app/api/test-auth-create`

---

## Recommended Fixes

### Fix 1: Ensure Service Role Key is in Vercel (Most Likely)
1. Go to Vercel Dashboard
2. Select "lensello-web" project
3. Settings → Environment Variables
4. Add/Update `SUPABASE_SERVICE_ROLE_KEY` with value from `.env.local`
5. Redeploy: `vercel deploy --prod`

### Fix 2: Regenerate Service Role Key (If Key is Compromised)
1. Go to Supabase Dashboard → Project Settings → API
2. Click "Regenerate" next to "service_role"
3. Copy new key
4. Update `.env.local` locally
5. Update Vercel environment variables
6. Redeploy

### Fix 3: Add Request Retry Logic (Resilience)
**File:** `apps/web/src/app/signup/actions.ts`
```typescript
async function createUserWithRetry(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  password: string,
  fullName: string,
  maxRetries = 3,
) {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      
      if (!createError) return { data: created, error: null };
      lastError = createError;
      
      // Don't retry on validation errors (e.g., email already exists)
      if (createError.code === 'user_already_exists') {
        return { data: null, error: createError };
      }
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  return { data: null, error: lastError };
}
```

### Fix 4: Add Better Error Messages (User Experience)
Distinguish between:
- "Network error - try again in a moment" (fetch failed, retry)
- "Email already exists" (user error, don't retry)
- "System is temporarily unavailable" (auth service down)

---

## Prevention Checklist

- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel before any future deployment
- [ ] Document that every env var in `.env.example` must be in Vercel settings
- [ ] Add a pre-deploy check that verifies Supabase connectivity
- [ ] Monitor Supabase status page for incidents
- [ ] Set up alerts if signup starts failing
- [ ] Regularly rotate service role key (quarterly)
- [ ] Add request logging/monitoring to catch similar issues earlier

---

## Files Modified for Debugging

To implement fixes, you'll need to modify:
- `apps/web/src/app/signup/actions.ts` - add logging and retry logic
- Vercel Project Settings - add environment variables
- `apps/web/src/app/api/test-auth-create/route.ts` - create (new file for testing)

---

## Testing After Fix

1. Local: `npm run dev` → fill signup form → should complete successfully
2. Production: `curl https://lensello-web-kappa.vercel.app/api/test-supabase`
3. Production: `curl -X POST https://lensello-web-kappa.vercel.app/api/test-auth-create`
4. Production: Visit signup form → complete flow → verify account exists in Supabase

---

## Additional Notes

- The error "fetch failed" typically means the HTTP request couldn't complete
- It's not a validation error (those would be specific: "invalid_password", "user_already_exists", etc.)
- The service role key is very permissive - only use in server code
- Signups should never be open without `LENSELLO_SIGNUP_CODE` set (current good practice observed)

---

**Next Step:** Start with CRITICAL action #1 - check Vercel environment variables. That's the most likely cause.
