# Lensello Phase 1: Foundation Data Model

## Overview

Phase 1 establishes the core infrastructure for Lensello's multi-photographer SaaS platform. It enables photographers to:

1. **Onboard** by selecting their photography categories
2. **Complete a Business Diagnostic** that captures baseline business metrics
3. **Receive LENS Scores** that quantify their marketing health across four dimensions

This foundation is **isolated** (no integration with existing studio schema yet) and focuses on photographer-centric data, not studio management.

---

## Database Schema

### 1. Photography Categories (`photography_categories`)

**Purpose**: Static lookup table for the types of photography a photographer can offer.

**Key Columns**:
- `id` (UUID, PK)
- `slug` (text, unique) — e.g., `wedding`, `engagement`, `portrait`
- `label` (text) — Display name, e.g., "Wedding"
- `description` (text) — e.g., "Weddings, ceremonies, receptions"
- `icon_emoji` (text) — Visual indicator for UI
- `position` (integer) — Sort order in dropdown/list
- `is_active` (boolean) — Soft-delete flag
- `created_at` (timestamptz)

**Pre-populated Categories**:
- Wedding, Engagement, Portrait, Headshot, Family, Newborn
- Event, Commercial, Real Estate, Boudoir, Sports, School, Pet, Product

**Access**: Public read (authenticated users). Read-only; data is managed by admins.

**Indexed**: `(position, is_active)` for efficient UI dropdowns.

---

### 2. Business Profiles (`business_profiles`)

**Purpose**: One record per photographer. Stores core business information and onboarding progress.

**Key Columns**:
- `id` (UUID, PK)
- `photographer_id` (UUID, FK to `auth.users`) — **Unique per photographer**
- `business_name` (text)
- `photographer_full_name` (text)
- `email` (text)
- `phone` (text)
- `photography_categories` (text[], array of category slugs) — e.g., `["wedding", "engagement"]`
- `primary_location` (text) — City/region
- `service_areas` (text) — Geographic coverage (free-form)
- `travel_willing` (boolean) — Willing to travel for bookings?
- `avg_booking_value_cents` (integer) — Typical gig price
- `price_low_cents`, `price_high_cents` (integer) — Price range
- `website_url` (text)
- `instagram_handle` (text) — Without the `@`
- `onboarding_step` (text enum) — `category_select` → `business_info` → `diagnostic` → `complete`
- `onboarding_completed_at` (timestamptz) — Null until final step
- `created_at`, `updated_at` (timestamptz)

**Access Control**:
- Photographers can read/update their own profile
- Staff can read all profiles
- Only the photographer can insert (on first signup)

**Indexes**:
- `(photographer_id)` — unique constraint
- `(onboarding_step)` — filter in-progress photographers
- `(created_at desc)` — recent signups

**Triggers**:
- `touch_updated_at` — auto-updates `updated_at` on any modification

---

### 3. Diagnostic Responses (`diagnostic_responses`)

**Purpose**: One-time questionnaire capturing baseline business metrics and context.

**Key Columns**:

#### LEAD (visibility & lead generation)
- `current_lead_volume` (enum) — `very_few`, `few`, `moderate`, `many`, `very_many`
- `desired_monthly_bookings` (integer) — Target booking rate

#### ELEVATE (perceived value & positioning)
- `ideal_client_description` (text) — Target market description
- `portfolio_quality` (enum) — `emerging`, `developing`, `strong`, `exceptional`

#### NURTURE (conversion & client experience)
- `response_time_hours` (integer) — How quickly they reply to inquiries
- `consultation_process_description` (text) — How they handle consultations
- `crm_tool_used` (text) — e.g., "HubSpot", "Pipedrive", "Notion"
- `email_or_sms_system` (text) — e.g., "Mailchimp", "Klaviyo"

#### SCALE (business metrics & efficiency)
- `annual_revenue_target_cents` (integer) — Year income goal
- `current_annual_revenue_cents` (integer) — Existing revenue (baseline)
- `seasonal_quiet_periods` (text) — e.g., "January–February"
- `profit_margin_percent` (integer) — 0–100

#### Marketing Baseline
- `has_website` (boolean)
- `has_active_google_business` (boolean)
- `active_marketing_channels` (text) — Comma-separated or JSON list
- `current_instagram_followers` (integer)

#### Integrations
- `has_meta_business_account` (boolean)
- `has_google_ads` (boolean)
- `has_stripe_connected` (boolean)

#### Qualitative
- `biggest_current_challenge` (text) — Open-ended feedback
- `success_story_or_proud_moment` (text) — Psychological anchor

**Constraints**:
- One diagnostic per photographer (unique on `business_profile_id`)
- Filled out once during onboarding, may be updated later

**Access Control**:
- Photographers can read/insert/update their own diagnostic
- Staff can read all diagnostics

**Indexes**:
- `(business_profile_id)` — unique constraint
- `(completed_at desc)` — recent completions

---

### 4. LENS Scores (`lens_scores`)

**Purpose**: Tracks the four dimensions of marketing health over time.

**The LENS Model**:
- **LEAD** (0–100) — Visibility and lead generation
  - Website traffic, SEO rankings, social followers, ad reach, lead volume
- **ELEVATE** (0–100) — Perceived value and positioning
  - Portfolio quality, reviews, brand positioning, website quality
- **NURTURE** (0–100) — Conversion and client experience
  - Response speed, follow-up rate, CRM usage, email/SMS engagement
- **SCALE** (0–100) — Business growth and efficiency
  - Pricing strategy, average transaction value, profit margin, capacity, automation

**Key Columns**:
- `id` (UUID, PK)
- `business_profile_id` (UUID, FK)
- `measured_at` (timestamptz) — When this snapshot was taken
- `lead_score` (smallint, 0–100) — LEAD dimension
- `lead_details` (jsonb) — Snapshot of underlying metrics (e.g., followers, impressions)
- `elevate_score` (smallint, 0–100) — ELEVATE dimension
- `elevate_details` (jsonb) — Portfolio size, review count, review rating, etc.
- `nurture_score` (smallint, 0–100) — NURTURE dimension
- `nurture_details` (jsonb) — Response time, CRM setup status, etc.
- `scale_score` (smallint, 0–100) — SCALE dimension
- `scale_details` (jsonb) — Avg booking value, annual revenue, profit margin, etc.
- `overall_score` (smallint, 0–100) — Average of the four
- `source` (enum) — How this score was generated
  - `diagnostic` — From onboarding questionnaire (baseline)
  - `campaign_impact` — Updated after a campaign completes
  - `manual_review` — By a coach or the photographer
  - `system_update` — Automatic recalculation from external integrations
- `note` (text) — Why scores changed (e.g., "Campaign completed: +12 leads generated")
- `created_at` (timestamptz)

**Immutability**: Once created, scores are never updated; new rows represent updates.
This allows full trend analysis.

**Access Control**:
- Photographers can read their own scores
- Staff (and only staff) can insert new scores

**Indexes**:
- `(business_profile_id, measured_at desc)` — Trend retrieval (primary query)
- `(source)` — Filter by source for auditing

---

## Data Flow

### Onboarding Journey

```
1. User signs up
   ↓
2. Business profile created (empty, onboarding_step = "category_select")
   ↓
3. Select photography categories
   └─ Update business_profile.photography_categories
   └─ Set onboarding_step = "business_info"
   ↓
4. Enter business info (name, location, pricing, website, Instagram)
   └─ Update business_profile with all fields
   └─ Set onboarding_step = "diagnostic"
   ↓
5. Answer diagnostic questionnaire
   └─ Insert into diagnostic_responses
   └─ Set onboarding_step = "complete"
   └─ Set onboarding_completed_at = now()
   ↓
6. Automatically initialize LENS scores
   └─ Calculate baseline from diagnostic responses
   └─ Insert first row into lens_scores (source = "diagnostic")
   └─ Photographer can now view their LENS dashboard
```

### Score Updates Over Time

Scores are updated in three ways:

#### A. Campaign Impact
When a marketing campaign completes:
1. Tally impressions, clicks, conversions, leads generated
2. Integrate with external metrics (Google Analytics, Meta Ads, Instagram Insights)
3. Recalculate LEAD, ELEVATE, NURTURE, SCALE based on new data
4. Insert new lens_scores row (source = "campaign_impact", note = description)

#### B. Manual Review
When a coach or photographer reviews progress:
1. Adjust scores based on qualitative judgment
2. Insert new lens_scores row (source = "manual_review", note = explanation)

#### C. System Recalculation
Scheduled job (daily or weekly):
1. Fetch all active integrations (Google Analytics, Stripe, CRM, etc.)
2. Recalculate scores
3. Insert new lens_scores row (source = "system_update")

**Trend Analysis**: Query the latest N scores per photographer to show trajectory:
- Improving (↑)
- Stable (→)
- Declining (↓)

---

## Server Actions (Phase 1 CRUD)

All actions in `apps/web/src/app/(onboarding)/actions.ts`:

### `getOrCreateBusinessProfile()`
- Called on first onboarding visit
- Returns existing profile or creates a new one
- Requires authentication

### `updateProfileCategories(categories, nextStep)`
- Saves selected photography categories
- Advances onboarding step
- Mutates `business_profiles.photography_categories` and `onboarding_step`

### `updateProfileBusinessInfo(...)`
- Saves business details (name, location, pricing, website, social)
- Advances to diagnostic step
- Partial updates (only provided fields)

### `saveDiagnosticResponses(...)`
- Saves all questionnaire answers
- Marks onboarding as complete
- Upserts if diagnostic already exists for this profile

### `initializeLensScores(businessProfileId)`
- Called after diagnostic completion
- Calculates baseline scores using heuristics
- Inserts first row into `lens_scores` with source = "diagnostic"

**Example Baseline Scoring Logic**:
- LEAD: +15 if Instagram > 1K, +10 if website exists, +10 if active marketing channels, +10 if Google Ads
- ELEVATE: +15 for "strong" portfolio, +25 for "exceptional", +10 if website exists
- NURTURE: +15 if response time ≤ 4 hours, +15 if CRM in place, +10 if email/SMS setup
- SCALE: +15 if annual revenue > £50k, +10 if profit margin > 40%, +10 if growth target set

---

## Row-Level Security (RLS) Policies

### photography_categories
- `SELECT`: All authenticated users (world-readable)

### business_profiles
- `SELECT`: Own profile OR staff
- `INSERT`: Only own profile
- `UPDATE`: Own profile OR staff

### diagnostic_responses
- `SELECT`: Own profile's diagnostic OR staff
- `INSERT`: Own profile only
- `UPDATE`: Own profile's diagnostic OR staff

### lens_scores
- `SELECT`: Own scores OR staff
- `INSERT`: Staff only (automated/coach-initiated updates)

---

## Constraints & Validation

### business_profiles
```sql
- photography_categories: non-empty array (when filled)
- price_low_cents ≤ price_high_cents (if both provided)
- business_name: non-empty string
```

### diagnostic_responses
```sql
- response_time_hours: > 0 (if provided)
- profit_margin_percent: 0–100 (if provided)
- desired_monthly_bookings: > 0 (if provided)
```

### lens_scores
```sql
- All score columns: 0–100
- overall_score: computed as average of four dimensions
```

---

## Next Steps: Integration with Phase 2+

### Phase 2: Marketing Campaign Foundation
- Link `lens_scores` to campaign performance
- Implement campaign impact calculations
- Add integration metrics (ad spend, clicks, conversions)

### Phase 3: Portfolio & Asset Linking
- Connect photographer's `shoots` and `assets` to ELEVATE scoring
- Calculate portfolio coverage per category
- Track asset selection trends

### Phase 4: Integration Sync
- Supabase webhooks on diagnostic changes
- Real-time score recalculation from:
  - Google Analytics (traffic, users)
  - Stripe (transactions, recurring revenue)
  - Meta/Google Ads APIs (ad performance)
  - CRM data (conversion rate, consultation → booking)

### Phase 5: Insights & Coaching
- Per-dimension coaching recommendations
- Roadmap generation based on LENS gaps
- A/B testing framework for optimization

---

## Testing the Foundation

### Manual SQL Checks
```sql
-- View all photographers in onboarding
SELECT * FROM business_profiles WHERE onboarding_step != 'complete';

-- Trend analysis for a photographer
SELECT * FROM lens_scores 
WHERE business_profile_id = '{id}'
ORDER BY measured_at DESC
LIMIT 10;

-- Score distribution
SELECT overall_score, COUNT(*) FROM lens_scores GROUP BY overall_score;
```

### Server Action Tests
1. Sign up a new photographer
2. Call `getOrCreateBusinessProfile()` — should create a record
3. Call `updateProfileCategories(["wedding", "portrait"])` — advance step
4. Call `updateProfileBusinessInfo()` with details — advance step
5. Call `saveDiagnosticResponses()` with sample data — mark complete
6. Call `initializeLensScores()` — calculate baseline
7. Query `lens_scores` — should see one row with calculated scores

---

## File Structure

```
supabase/migrations/
  20260905180000_phase1_foundation.sql   ← Schema + RLS + initial data

packages/core/src/
  types.ts                               ← PhotographyCategory, BusinessProfile,
                                           DiagnosticResponse, LensScore types

apps/web/src/app/(onboarding)/
  actions.ts                             ← Server actions for CRUD

PHASE1_FOUNDATION.md                      ← This document
```

---

## Environment Variables

No new env vars required for Phase 1; existing Supabase configuration is used.

---

## Performance Considerations

1. **Photography Categories**: Cached lookup (rarely changes)
2. **Business Profiles**: Per-photographer write (low contention)
3. **Diagnostic Responses**: One-time write per photographer
4. **LENS Scores**: Append-only; range queries on `measured_at` indexed

For 1,000 photographers with weekly score updates:
- 52,000 lens_scores rows per year
- Index on `(business_profile_id, measured_at desc)` keeps trend queries fast

---

## Security & Compliance

- **No sensitive data in details JSON**: Avoid storing API keys, auth tokens, or PII
- **RLS enforced at table level**: Backend never trusts `photographer_id` from client
- **Audit trail**: `lens_scores.note` and `source` provide traceability
- **Read-only for photographers on scores**: Prevents tampering; coaches/staff update

---

## Schema Diagram (Conceptual)

```
photography_categories (static lookup, ~14 records)
         ↑
         │ (array reference)
         │
business_profiles (1 per photographer)
         │
         ├─→ diagnostic_responses (1 per photographer)
         │
         └─→ lens_scores (append-only history)
                (source: diagnostic | campaign_impact | manual_review | system_update)
```

---

## Questions & Decisions

### Q: Why is LENS scores append-only, not update-in-place?
**A**: Allows trend analysis without losing history. Dashboard can show 52-week trajectory per dimension.

### Q: Why aren't reviews/ratings in the schema?
**A**: Those will come from integrations (Google, Yelp, internal) in Phase 2+.
The `elevate_details` JSON is where we store "google_review_count": 23, "average_rating": 4.8, etc.

### Q: Why is onboarding_step text enum, not a Postgres enum type?
**A**: Easier migration if steps change. Adding a new step is an ALTER CHECK, not ALTER ENUM (which is complex to revert).

### Q: How do we know when to update scores automatically?
**A**: Phase 2 will define a scheduler (job queue or cron). Phase 1 is manual/on-demand only.

### Q: Can photographers be in multiple studios?
**A**: Phase 1 treats photographers as independent. Multi-studio support is a future phase.

---

## Rollback Plan

If Phase 1 needs to be rolled back:

```bash
# Drop Phase 1 tables in reverse order (respecting FKs)
DROP TABLE IF EXISTS public.lens_scores;
DROP TABLE IF EXISTS public.diagnostic_responses;
DROP TABLE IF EXISTS public.business_profiles;
DROP TABLE IF EXISTS public.photography_categories;

# Existing tables (campaigns, gigs, clients, etc.) remain untouched
```

This migration is isolated; no changes to existing schema or RLS.

---

## Next Development Checkpoint

- [ ] Deploy migration to Supabase
- [ ] Generate TypeScript types: `npm run db:types`
- [ ] Build onboarding UI components using these actions
- [ ] Write E2E tests for full onboarding flow
- [ ] Create dashboard LENS score visualization
- [ ] Integrate campaign completion → LENS score update (Phase 2)
