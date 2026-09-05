# Lensello Phase 1: Complete File Manifest

## Deliverables Overview

Lensello Phase 1 Foundation scaffolds the database, TypeScript types, and server actions needed for photographer onboarding with LENS scoring.

**Status**: Complete and ready for integration testing.

---

## Files Created/Modified

### 1. Database Migration
**File**: `supabase/migrations/20260905180000_phase1_foundation.sql`
- **Lines**: 500
- **Purpose**: Create all Phase 1 tables with RLS and constraints
- **Tables Created**:
  - `photography_categories` (pre-populated with 14 types)
  - `business_profiles` (photographer info + onboarding progress)
  - `diagnostic_responses` (questionnaire answers)
  - `lens_scores` (append-only score history)

**How to Deploy**:
```bash
# Automatically detected and applied by Supabase CLI
supabase db push
```

---

### 2. TypeScript Types
**File**: `packages/core/src/types.ts`
- **Lines Added**: ~150
- **Purpose**: Interfaces for all new entities + const enums
- **What's Added**:
  - `PhotographyCategory` interface
  - `BusinessProfile` interface
  - `DiagnosticResponse` interface
  - `LensScore` interface
  - `PHOTOGRAPHY_CATEGORY_SLUGS` (const array)
  - `ONBOARDING_STEPS` (const array)
  - `LEAD_VOLUME_LEVELS` (const array)
  - `PORTFOLIO_QUALITY_LEVELS` (const array)
  - `LENS_SCORE_SOURCES` (const array)

**How to Use**:
```typescript
import type { BusinessProfile, LensScore, DiagnosticResponse } from '@lensello/core';

const profile: BusinessProfile = { ... };
```

---

### 3. Server Actions
**File**: `apps/web/src/app/(onboarding)/actions.ts`
- **Lines**: 496
- **Purpose**: CRUD operations for onboarding flow
- **Functions Exported**:

#### `getOrCreateBusinessProfile()`
- Returns existing profile or creates new one
- Called on first onboarding visit
- Type: `() => Promise<{ profile: BusinessProfile | null; error?: string }>`

#### `updateProfileCategories(input)`
- Saves selected photography categories
- Advances onboarding step
- Input: `{ categories: PhotographyCategorySlug[]; nextStep: string }`
- Returns: `{ success: boolean; error?: string }`

#### `updateProfileBusinessInfo(input)`
- Saves business details (name, location, pricing, website, social)
- Partial update (only provided fields)
- Input: 12 optional fields (businessName, email, phone, primaryLocation, etc.)
- Returns: `{ success: boolean; error?: string }`

#### `saveDiagnosticResponses(input)`
- Saves 40+ questionnaire fields
- Marks onboarding as complete
- Upserts if diagnostic already exists
- Input: All diagnostic question answers (optional)
- Returns: `{ success: boolean; diagnosticId?: string; error?: string }`

#### `initializeLensScores(input)`
- Calculates baseline scores from diagnostic
- Inserts first row into lens_scores table
- Input: `{ businessProfileId: string }`
- Returns: `{ success: boolean; scoreId?: string; error?: string }`

#### `calculateBaselineScores(diagnostic)` (internal helper)
- Converts questionnaire answers → 4D LENS scores
- Uses heuristic logic
- Returns object with leadScore, elevateScore, nurtureScore, scaleScore, overallScore + details

**How to Use**:
```typescript
'use client';
import { updateProfileCategories, saveDiagnosticResponses } from './actions';

// In onboarding form:
const result = await updateProfileCategories({
  categories: ['wedding', 'engagement', 'portrait'],
  nextStep: 'business_info'
});

if (result.success) {
  // Navigate to next step
} else {
  console.error(result.error);
}
```

---

## Documentation Files

### 4. Detailed Design Document
**File**: `PHASE1_FOUNDATION.md`
- **Lines**: ~600
- **Audience**: Developers, architects, future maintainers
- **Contents**:
  - Complete schema documentation (all 4 tables)
  - Column definitions, constraints, indexes
  - RLS policies explained
  - Full data flow diagrams
  - Score calculation logic
  - Server action reference
  - Integration points for Phase 2+
  - Testing guidelines
  - Security & compliance notes
  - Q&A (common questions)
  - Rollback procedures

**When to Read**: Before coding features that interact with Phase 1 data.

---

### 5. Implementation Summary
**File**: `PHASE1_IMPLEMENTATION_SUMMARY.md`
- **Lines**: ~400
- **Audience**: Project managers, team leads, integration team
- **Contents**:
  - High-level overview of what was built
  - Summary of each deliverable
  - Data flow overview
  - LENS dimensions explained
  - Integration points for Phase 2+
  - Deployment checklist
  - File manifest and line counts
  - Key design decisions
  - Performance & scale analysis
  - Deployment timeline estimate

**When to Read**: To understand scope and integration points.

---

### 6. File Manifest (This File)
**File**: `PHASE1_MANIFEST.md`
- **Purpose**: Quick reference index
- **Best For**: Finding files, understanding what each file does

---

## Quick Reference

### To Deploy
1. `cd /c/Users/mcpag/lensello`
2. `git checkout -b phase-1-foundation` (create feature branch)
3. `supabase db push` (apply migration)
4. `npm run db:types` (generate types)
5. `npm run typecheck` (verify no errors)
6. `git add . && git commit` (commit changes)
7. `git push origin phase-1-foundation` (push to review)

### To Use in Your Code
```typescript
// 1. Import types
import type { BusinessProfile, LensScore } from '@lensello/core';

// 2. Import server actions
import {
  getOrCreateBusinessProfile,
  updateProfileCategories,
  saveDiagnosticResponses,
  initializeLensScores,
} from '@/app/(onboarding)/actions';

// 3. Call from your React component
'use client';
const handleCategorySelect = async (categories) => {
  const result = await updateProfileCategories({
    categories,
    nextStep: 'business_info'
  });
  if (result.success) {
    // Proceed to next step
  }
};
```

### To Query Data (SQL)
```sql
-- Get photographer's current onboarding progress
SELECT onboarding_step, onboarding_completed_at 
FROM business_profiles 
WHERE photographer_id = '{user_id}';

-- Get photographer's latest LENS score
SELECT * FROM lens_scores 
WHERE business_profile_id = '{profile_id}'
ORDER BY measured_at DESC 
LIMIT 1;

-- View LENS score trend (last 52 weeks)
SELECT measured_at, overall_score, lead_score, elevate_score, nurture_score, scale_score
FROM lens_scores
WHERE business_profile_id = '{profile_id}'
ORDER BY measured_at DESC
LIMIT 52;

-- Find photographers in diagnostic step
SELECT bp.business_name, bp.email 
FROM business_profiles bp
WHERE bp.onboarding_step = 'diagnostic'
ORDER BY bp.created_at DESC;
```

### To Test Locally
1. Start dev server: `npm run dev`
2. Sign up as a new photographer
3. Call `getOrCreateBusinessProfile()` → should create empty profile
4. Call `updateProfileCategories(['wedding'])` → should advance step
5. Call `updateProfileBusinessInfo({ businessName: 'My Studio', ... })` → should save
6. Call `saveDiagnosticResponses({ ... })` → should mark complete
7. Call `initializeLensScores({ businessProfileId: '...' })` → should calculate baseline
8. Query database to verify data was persisted correctly

---

## Dependencies

Phase 1 requires only existing project dependencies:
- Next.js 16 (already installed)
- Supabase JS client (already installed)
- TypeScript (already installed)

No new npm packages needed.

---

## Database Constraints Summary

All constraints are in `20260905180000_phase1_foundation.sql`:

### business_profiles
```
- photographer_id: UNIQUE (one profile per photographer)
- business_name: NOT NULL, non-empty string
- photography_categories: non-empty array when filled
- price_low_cents ≤ price_high_cents (logical constraint)
- created_at, updated_at: AUTO-UPDATED
```

### diagnostic_responses
```
- business_profile_id: UNIQUE (one diagnostic per photographer)
- response_time_hours: > 0 when provided
- profit_margin_percent: 0–100
- desired_monthly_bookings: > 0 when provided
```

### lens_scores
```
- All scores: 0–100 range
- overall_score: computed (no manual edits)
- source: enum (diagnostic | campaign_impact | manual_review | system_update)
```

---

## RLS Policy Summary

| Table | Select | Insert | Update |
|-------|--------|--------|--------|
| `photography_categories` | ✅ Authenticated | ❌ | ❌ |
| `business_profiles` | ✅ Own \| Staff | ✅ Own | ✅ Own \| Staff |
| `diagnostic_responses` | ✅ Own \| Staff | ✅ Own | ✅ Own \| Staff |
| `lens_scores` | ✅ Own \| Staff | ✅ Staff only | ❌ |

---

## Integration Checkpoints for Phase 2+

### Phase 2: Campaign Scoring
- Link `lens_scores` to campaign performance
- New table: `campaign_impacts` (intermediate results)
- Webhook on campaign completion → insert lens_scores with source="campaign_impact"

### Phase 3: Portfolio Integration
- Connect photographer's `shoots` and `assets` to ELEVATE scoring
- Count portfolio assets per photography_category
- Recalculate ELEVATE score monthly

### Phase 4: External Integrations
- Google Analytics → feed LEAD metrics
- Stripe → feed SCALE metrics (revenue)
- Meta/Google Ads → feed LEAD metrics (ad performance)
- CRM → feed NURTURE metrics (conversion rate)
- Scheduled job → weekly recalculation

### Phase 5: AI-Powered Scoring
- Replace heuristics with ML model
- Train on photographer success metrics
- Personalize scoring per photography category

---

## Security Checklist

- ✅ RLS enforced at Postgres level (not app-level)
- ✅ No API keys/tokens in JSON fields
- ✅ Photographers cannot insert scores (only staff/system)
- ✅ Audit trail: `lens_scores.source` + `note` track changes
- ✅ Seasonal quiet periods stored; no sensitive secrets expected
- ✅ Email/phone fields require photographer to provide

---

## Performance Notes

**Indexes Created**:
- `business_profiles(photographer_id)` — unique constraint
- `business_profiles(onboarding_step)` — fast filtering
- `business_profiles(created_at desc)` — recent signups
- `diagnostic_responses(business_profile_id)` — unique constraint
- `diagnostic_responses(completed_at desc)` — recent completions
- `lens_scores(business_profile_id, measured_at desc)` — **CRITICAL** for trend queries
- `lens_scores(source)` — audit filtering

**Expected Query Performance**:
- Fetch latest score for a photographer: <5ms
- Fetch 52-week trend: <10ms
- Fetch all photographers in onboarding: <100ms

---

## File Sizes

| File | Lines | Size |
|------|-------|------|
| `20260905180000_phase1_foundation.sql` | 500 | 16 KB |
| `types.ts` (additions) | 150 | 4 KB |
| `actions.ts` | 496 | 16 KB |
| `PHASE1_FOUNDATION.md` | 600 | 25 KB |
| `PHASE1_IMPLEMENTATION_SUMMARY.md` | 400 | 18 KB |
| `PHASE1_MANIFEST.md` | 250 | 10 KB |
| **Total** | ~2,400 | ~89 KB |

---

## Next Development Steps

1. **Merge to main** (after code review)
2. **Deploy to staging** (Supabase staging environment)
3. **Generate types** (`npm run db:types`)
4. **Build UI components** (separate PR):
   - Photography category selector
   - Business info form
   - Diagnostic questionnaire (40+ fields)
   - LENS score dashboard
5. **Write E2E tests** (full onboarding flow)
6. **Manual testing** with real photographer data
7. **Deploy to production**
8. **Plan Phase 2** (campaign scoring)

---

## Questions?

- **Schema details?** → Read `PHASE1_FOUNDATION.md`
- **How to integrate?** → Read `PHASE1_IMPLEMENTATION_SUMMARY.md`
- **Quick reference?** → You're reading it (this file)
- **Server action signatures?** → Check `actions.ts` JSDoc
- **Database migration?** → Check `20260905180000_phase1_foundation.sql`

---

## Author & Date

Created: 2026-09-05
For: Michael Pagano (michael.pagano@xerensys.ai)
Platform: Xerensys Lensello Photography Marketing Platform
Phase: 1 Foundation (Photographer Onboarding & LENS Scoring)

---

## Versioning

- **Phase 1**: Foundation (this release)
  - Photographer onboarding
  - Business diagnostic questionnaire
  - LENS scores (baseline calculation)

- **Phase 2**: Campaign Integration
  - Campaign performance → LENS updates
  - Marketing dashboard

- **Phase 3**: Portfolio & Asset Integration
  - Portfolio quality scoring
  - Photography type coverage

- **Phase 4**: External Integrations
  - Google Analytics sync
  - Stripe revenue tracking
  - Ad platform integrations
  - CRM integration

- **Phase 5+**: Advanced Features
  - AI-powered scoring
  - Coaching recommendations
  - A/B testing framework
  - Multi-studio support
