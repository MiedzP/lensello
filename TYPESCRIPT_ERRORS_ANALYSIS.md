# TypeScript Errors Analysis

**Total Errors Found:** 60+  
**Date:** August 28, 2026

---

## 🎯 Error Categories

### 1. String-to-Union Type Mismatches (35+ errors)
**Pattern:** String value assigned to union type like `"draft" | "active" | "review"`

**Files Affected:**
- `academy/` - lesson status strings
- `ads/` - platform and status strings  
- `campaigns/` - platform and status strings
- `clients/` - stage strings
- `gigs/` - status and contract status strings
- `galleries/` - layout type strings
- `library/` - file status strings
- `onboarding/` - step strings

**Root Cause:** Database returns strings, but TypeScript expects specific literal types

**Fix:** Type-cast or validate strings at query boundaries

---

### 2. Missing Properties on Database Types (8+ errors)
**Pattern:** Property doesn't exist on type (e.g., `diagnostic_last_assessed`)

**Files Affected:**
- `diagnostic/page.tsx` - diagnostic_* properties missing
- `admin/users/page.tsx` - email property missing from profile
- `admin-signup/actions.ts` - temp_credentials table not in schema

**Root Cause:** Database schema updated but TypeScript types not regenerated

**Fix:** Run `npx supabase gen types typescript` to regenerate types

---

### 3. Discriminated Union Errors (12+ errors)
**Pattern:** Accessing `.error` on result type that only has `.ok` and success fields

**Files Affected:**
- `galleries/[galleryId]/actions.ts` - PortalInviteResult.error
- `gigs/[gigId]/page.tsx` - GigParseResult.errors
- `api/v1/automations/` - ApiAuthResult.response
- `app/g/[token]/actions.ts` - AuthResult.error
- `portal/` - Multiple result type errors

**Root Cause:** Result types changed to have different shapes for ok/error cases

**Fix:** Check result.ok before accessing error fields, or use proper discriminated union handling

---

### 4. Redirect Type Issues (2 errors)
**Pattern:** `redirect('/path' as any)` - type assertion needed

**Files Affected:**
- `diagnostic/page.tsx(15, 25)` - redirect calls

**Root Cause:** Redirect function has strict route typing

**Fix:** Remove `as any` or update type definitions

---

## 🔴 Critical Errors (Block Deployment)

1. **Diagnostic page (3 errors)** - Missing database fields, type issues
2. **Result type discriminator (12 errors)** - Accessing wrong properties on result types
3. **String unions (35 errors)** - Type safety violations throughout

---

## 🟠 Medium Priority

1. **Database type regeneration** - After running supabase gen types
2. **Discriminated union handling** - Update code to check result.ok first
3. **Route typing** - Remove `as any` casts from redirects

---

## ✅ Quick Wins Completed

- ✅ Added 4 missing navigation links (diagnostic, monthly-review, quarterly-planning, rhythm)
- ✅ Created settings root page
- ✅ Created lens/types.ts with proper diagnostic types
- ✅ Updated diagnostic/page.tsx (partial - still has issues)

---

## 📋 Recommended Fix Order

### Phase 1: Type System Foundation (1-2 hours)
1. Regenerate Supabase types: `cd apps/web && npx supabase gen types typescript > src/lib/database.types.ts`
2. Update db.types.ts to include diagnostic_* fields
3. Fix discriminated union handling patterns

### Phase 2: File-by-File Fixes (2-3 hours)
1. Fix academy/ lesson status types
2. Fix ads/ platform and status types
3. Fix campaigns/ platform and status types
4. Fix gigs/ status types
5. Fix clients/ stage types
6. Fix galleries/ layout types

### Phase 3: Verification (30 minutes)
1. Run typecheck again
2. Verify all errors are resolved
3. Test each feature in browser

---

## 🛠️ Implementation Strategy

Rather than fix all 60 errors manually, we should:

1. **Fix the root causes first:**
   - Regenerate Supabase types (fixes missing properties)
   - Update discriminated union handling (fixes 12 errors)
   - Use string validation at type boundaries (fixes string union errors)

2. **Create helper functions:**
   - Type guard for status values
   - Type guard for platform values
   - Discriminated union pattern for results

3. **Test incrementally:**
   - After each category fixed, run typecheck
   - Verify no regressions

---

## 📊 Estimate

- **With focused fixes:** 3-4 hours
- **Without addressing root causes:** 8+ hours
- **Better approach:** Focus on patterns, not individual errors

