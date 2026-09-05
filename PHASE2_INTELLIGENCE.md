# Lensello Phase 2: Intelligence Engine Scaffold

## Overview

This scaffold implements the decision-making layer for Lensello's photography marketing platform. It classifies business state into RED/AMBER/GREEN priorities, tracks marketing health via the LENS framework, and auto-generates goal-led marketing campaigns.

## Files Created

### 1. `types.ts` - Core Data Types (11KB)

Comprehensive TypeScript interfaces for the entire intelligence engine:

- **PhotographyCategory** - 14 photography types (weddings, engagements, family, newborns, etc.)
- **PriorityLevel** enum + Red/Amber/Green Indicators (6/6/7 specific signals each)
- **PriorityScore** - Classification result with score, indicators, actions, confidence
- **LENSMetrics** - Four-pillar framework: Leads, Enquiry quality, Nurture, Sales (plus CPL, ROAS, SEO)
- **OperatingRhythmViews** - Daily/Weekly/Monthly/Quarterly structures
- **CampaignBuilder** - Step A/B/C wizard types + CampaignTemplate + GeneratedCampaign
- **BusinessProfile** - Phase 1 integration model (goals, constraints, categories)

### 2. `scoring-algorithm.ts` - Decision Engine (20KB)

Server-side logic for RED/AMBER/GREEN classification:

**Main Function:**
```typescript
scoreBusinessPriority(businessId, category, metrics, previousMetrics, goals)
  → PriorityScore
```

**Key Features:**
- `detectRedIndicators()` - 6 crisis signals (CPL risen, conversion dropped, leads not followed, bookings behind, campaign perf drop, funnel leaking)
- `detectAmberIndicators()` - 6 opportunity signals (historic unnurtured, seasonal window, SEO opportunity, past client reactivation, lead quality declining, ad efficiency drop)
- `detectGreenIndicators()` - 7 healthy signals (SEO generating, CPL improving, conversion healthy, nurture converting, booking value rising, ROI strong, pipeline healthy)

**Scoring Logic:**
1. Collect all indicators for current metrics
2. Calculate weighted score for each level (RED/AMBER/GREEN)
3. Determine priority level (highest score wins)
4. Convert to 0-100 scale
5. Generate 3 recommended actions context-aware to situation
6. Calculate confidence based on data richness + indicator agreement

**Thresholds (Configurable):**
- CPL threshold increase: 15% → RED
- Conversion drop threshold: 20% → RED
- Lead follow-up SLA: 24 hours
- Bookings target ratio: 80%
- Campaign ROAS decline: 25% → RED
- Funnel conversion minimum: 5% (for RED)
- SEO consistency window: 14 days
- CPL improvement: 5% → GREEN
- Conversion health: 15% → GREEN
- Nurture target conversion: 20% → GREEN
- Booking value growth: 10% → GREEN
- Campaign ROI target: 3x → GREEN
- Pipeline days coverage: 30 → GREEN

### 3. `campaign-templates.ts` - Template Library (17KB)

Pre-built marketing frameworks by category + priority:

**Templates Included:**
1. **Weddings → More Enquiries** - Volume-focused campaign
   - Meta ads (Facebook/Instagram), engagement-focused landing page
   - 7-day nurture sequence, calendar booking integration
   - Benchmarks: 3.5% CTR, 12% conversion, $45 CPL, $3,500 avg booking value, 60-day payback

2. **Weddings → Higher Value** - Premium upsell campaign
   - Retargeting to website visitors + warm leads
   - Videography + album add-ons, premium package positioning
   - Benchmarks: 4.5% CTR, 25% conversion (warm audience), $20 CPL, $1,200 upsell value, 30-day payback

3. **Engagements → More Enquiries** - Engagement session campaign
   - Newly engaged couples (0-6 months)
   - "Perfect for save-the-dates & announcements" messaging
   - Benchmarks: 4% CTR, 10% conversion, $50 CPL, $400 session value

4. **Reactivate Past Clients** - Generic win-back campaign
   - Email-driven (minimal paid spend)
   - 20% discount offer, targeted at 12+ months no booking
   - Benchmarks: 6% email CTR, 15% conversion, $5 CPL, $500 avg value, 20-day payback

**Template Structure:**
```
CampaignTemplate {
  framework: {
    meta: { platforms, audienceSegment, budget, duration, sampleAds[] },
    landingPage: { template, headline, subheading, propositionPoints[], cta },
    form: { fields[], successMessage, autoResponder },
    crm: { automationSequence, segmentTag },
    nurture: { emailSequence[], smsTemplates[] },
    appointment: { calendarSync, bookingPage, reminderSequence },
    booking: { proposalTemplate, contractTemplate, paymentTerms },
    reporting: { kpis[], dashboard }
  },
  benchmarks: { expectedCTR, expectedConversion, expectedCPL, expectedBookingValue, paybackPeriod },
  implementation: { setup[], timeline[], ownerRole, dependencies[] }
}
```

**Lookup Functions:**
- `getCampaignTemplate(category, priority)` - Single template
- `getCampaignTemplatesByCategory(category)` - All for category
- `getCampaignTemplatesByPriority(priority)` - All for priority

### 4. `ui-components.tsx` - React Components (24KB)

Component sketches for all four operating rhythm views + campaign builder:

**Daily View Component:**
- Alert cards (5 top alerts, color-coded by priority)
- Compact metric grid (leads received, followed up, unanswered, appointments, pipeline value)
- Quick action buttons (View All Leads, Send Follow-ups, Update Pipeline)

**Weekly View Component:**
- 3-column layout: Red Fix | Amber Grow | Green Continue
- Each slot shows: priority score, focus statement, expected outcome, due date, action button
- Weekly metrics summary (leads generated, enquiries converted, bookings created, total value)

**Monthly View Component:**
- 6-card LENS dashboard:
  - L (Leads): total, new, followed up, response time, source breakdown
  - E (Enquiry): quality score, engagement rate, abandonment rate
  - N (Nurture): leads in sequence, conversion rate, avg time in nurture
  - S (Sales): revenue, bookings, avg booking value, conversion rate
  - Metrics: CPL, ROAS, organic traffic
  - SEO: top 5 keywords + rankings
- Performance vs Target table (metric, target, actual, variance%)
- Bottleneck narrative (auto-generated insight)

**Quarterly View Component:**
- Business vs Goals cards (on-track / at-risk status)
- Constraints list
- Seasonal considerations
- Next Quarter Plan (focus, investment areas, expected outcome)

**Campaign Builder Wizard:**
- Step A: Category grid (14 emoji-labeled buttons)
- Step B: Priority options (adapt by category, e.g., weddings: more enquiries / higher value / destination / fill dates / etc)
- Step C: Template preview (name, benchmarks, customization sliders for budget $500-$10k and duration 7-90 days)

### 5. `database-schema.sql` - Supabase Tables (13KB)

Complete schema for Phase 2 data:

**Priority Tables:**
- `priority_rules` - Business-specific thresholds (CPL %, conversion %, lead SLA hours, etc)
- `priority_scores` - Classification history (expires 30 days), indexed by business/category/date

**Operating Rhythm Tables:**
- `operating_rhythm_alerts` - Daily alerts (expires 7 days)
- `daily_views` - Cached snapshots (leads, follow-ups, unanswered, appointments, pipeline)
- `weekly_views` - Red/Amber/Green slots + weekly metrics
- `monthly_views` - LENS snapshot + performance vs target + bottleneck
- `quarterly_views` - Goals, constraints, seasonal, next-quarter plan

**LENS Metrics Table:**
- `lens_metrics` - Time-series fact table (one row per business/category/period)
  - All L/E/N/S metrics + CPL + ROAS + SEO data
  - Indexed by (business_id, period, metric_date)
  - Partitioned design for scalability

**Campaign Tables:**
- `campaign_templates` - Pre-built templates (seeded via campaign-templates.ts)
- `generated_campaigns` - User-created campaigns (draft → approved → active → completed)

**Business Context:**
- `business_goals` - Category-specific targets
- `business_constraints` - Budget, team, seasonal limits

**Security:**
- RLS enabled on all tables
- Users see only their business_id data
- Policies cascade through foreign keys

**Performance:**
- Indexes on common queries (business_id, level, expires_at, period, date)
- View: `daily_priority_summary` (aggregated alerts + priority scores)

---

## How It Works

### 1. Scoring Flow (Happens Weekly)

```
Current Metrics (LENSMetrics) + Previous Period Metrics
         ↓
  Detect All Indicators
  ├─ RED indicators (if crisis)
  ├─ AMBER indicators (if opportunity)
  └─ GREEN indicators (if healthy)
         ↓
  Calculate Weighted Scores
  ├─ redScore = sum(weights for red indicators)
  ├─ amberScore = sum(weights for amber indicators)
  └─ greenScore = sum(weights for green indicators)
         ↓
  Determine Level (highest score wins)
         ↓
  Convert to 0-100 Scale
         ↓
  Generate 3 Recommended Actions
         ↓
  PriorityScore { level, score, indicators, actions, confidence }
         ↓
  Store in priority_scores table (expires 30 days)
```

### 2. LENS Aggregation (Happens Daily)

Raw data from Phase 1 (enquiries, bookings, campaigns, emails) is aggregated into monthly `lens_metrics` row:

```
Phase 1 Data (enquiries.*, bookings.*, campaigns.*, emails.*)
         ↓
Aggregate by Business + Category + Period
  ├─ L: COUNT leads, group by source, calc response time
  ├─ E: Avg quality score, engagement rate, abandonment
  ├─ N: COUNT in sequences, DIVIDE conversions/total, calc dropoff
  ├─ S: SUM revenue, COUNT bookings, avg value, conversion rate
  └─ Calculate: CPL = spend/leads, ROAS = revenue/spend
         ↓
INSERT into lens_metrics
```

### 3. Operating Rhythm View Generation

**Daily** (runs every morning):
- Fetch unanswered enquiries from last 24 hours
- Count new leads, followed-up, appointments
- Sum pipeline value
- Create alert cards for each open item
- Insert/update daily_views row

**Weekly** (runs Monday morning):
- Fetch priority_scores for this week (or recalculate)
- Assign to Red Fix / Amber Grow / Green Continue slots
- Aggregate weekly metrics (leads, conversions, bookings, value)
- Create weekly_views row with recommendations

**Monthly** (runs 1st of month):
- Fetch/aggregate LENS metrics for previous month
- Query goals vs actuals
- Identify bottleneck (which funnel stage has worst metrics?)
- Create monthly_views row

**Quarterly** (runs 1st week):
- Fetch goals for quarter, compare actuals to date
- List business constraints + seasonal factors
- Generate next-quarter plan narrative
- Create quarterly_views row

---

## Integration Checklist (Phase 2b)

### Database
- [ ] Deploy schema to Supabase
- [ ] Seed campaign_templates table
- [ ] Create default priority_rules
- [ ] Enable RLS policies
- [ ] Create indices for performance

### API Layer
- [ ] Implement `POST /api/score-priority` (returns PriorityScore)
- [ ] Implement `GET /api/lens-metrics/:businessId/:category/:month`
- [ ] Implement `GET /api/operating-rhythm/daily/:businessId`
- [ ] Implement `GET /api/operating-rhythm/weekly/:businessId`
- [ ] Implement `GET /api/operating-rhythm/monthly/:businessId`
- [ ] Implement `GET /api/operating-rhythm/quarterly/:businessId`
- [ ] Implement `GET /api/campaigns/templates/:category/:priority`
- [ ] Implement `POST /api/campaigns/create` (wizard submission)

### Data Pipeline
- [ ] Set up daily cron to aggregate LENS metrics from Phase 1
- [ ] Set up daily job to generate daily_views + alerts
- [ ] Set up weekly job to generate weekly_views (Monday 6am)
- [ ] Set up monthly job to generate monthly_views (1st of month 6am)
- [ ] Set up quarterly job to generate quarterly_views (1st week 6am)

### Frontend
- [ ] Wire DailyViewComponent to `/dashboard/daily`
- [ ] Wire WeeklyViewComponent to `/dashboard/weekly`
- [ ] Wire MonthlyViewComponent to `/dashboard/monthly`
- [ ] Wire QuarterlyViewComponent to `/dashboard/quarterly`
- [ ] Wire CampaignBuilderWizard to `/campaigns/new`
- [ ] Connect to business profile (categories, goals, constraints)
- [ ] Add authentication guards (JWT middleware)

### Testing
- [ ] Unit test: scoring algorithm with mock metrics
- [ ] Integration test: LENS aggregation vs Phase 1 data
- [ ] E2E test: Campaign builder → template → generated_campaign
- [ ] Load test: 1000+ photographers, scoring under 100ms

---

## Key Design Decisions

### Why RED/AMBER/GREEN?
- Simple mental model (urgent / important / stable)
- Matches real business prioritization
- Supports weekly planning ritual (pick 1-3 per slot)
- Easy to explain to non-technical users

### Why LENS?
- Diagnostic (shows where funnel breaks)
- Holistic (covers entire customer journey)
- Actionable (each component has clear owner + levers)
- Framework familiar to marketers (AIDA, AARRR, etc)

### Why Goal-Led Campaign Builder?
- Outcome-first, not channel-first (wrong-headed default)
- Pre-tested templates reduce friction
- Benchmarks set realistic expectations
- Customization prevents one-size-fits-all
- Creates repeatable playbooks

### Why Isolated Scaffold?
- No integration risk to Phase 1
- Can be tested standalone with mock data
- Lets architects review + iterate logic before deployment
- Parallel development (Phase 1 team can keep shipping)

---

## Threshold Tuning Strategy

**Start with defaults** (in `scoring-algorithm.ts`):
- CPL +15%, Conversion -20%, Response >24h, ROAS down 25%, etc.

**Monitor in production:**
- Track how many RED alerts actually need intervention
- Track how many GREEN businesses maintain that status
- Calculate false positive rate (alert fired, business didn't need action)

**Customize per business:**
- If photographer says "I tolerate 25% CPL swings", override default in priority_rules
- If category-specific (e.g., seasonal businesses), create category defaults
- If industry-wide (e.g., all wedding photographers), adjust global defaults

**Iterate quarterly:**
- Review accuracy metrics
- Update thresholds based on real outcomes
- Share learnings across customer base

---

## Future Work (Post-Phase 2)

**Phase 2d (Advanced):**
- ML-powered lead quality scoring (replace hand-scored)
- Predictive churn (which leads will drop?)
- Anomaly detection (unusual patterns)
- Cross-sell recommendations ("Family photographers should add Newborn")
- ROI attribution (which touchpoint caused booking?)

**Phase 2e (Automation):**
- Auto-pause underperformers (RED threshold)
- Auto-scale winners (GREEN threshold)
- Auto-generate monthly LENS reports
- Auto-trigger campaign builder ("Try this based on your priority")

**Phase 2f (Collaboration):**
- Shared template marketplace (photographers share playbooks)
- Peer benchmarking ("Your CPL vs industry average")
- Coach/agency accounts (manage multiple photographers)
- Campaign approval workflows

---

## Status

**Created:** September 2026  
**Scope:** Phase 2 Scaffold (Logic Layer + Types + Templates)  
**Status:** NOT YET INTEGRATED (isolated development)  
**Confidence:** High (algorithm sound, templates field-tested conceptually)  
**Next Step:** Deploy to Supabase, wire to Phase 1 data, test with 10-20 beta photographers

---

## Files Reference

| File | Size | Purpose |
|------|------|---------|
| `types.ts` | 11KB | Core interfaces |
| `scoring-algorithm.ts` | 20KB | Scoring logic |
| `campaign-templates.ts` | 17KB | Template library |
| `ui-components.tsx` | 24KB | React components |
| `database-schema.sql` | 13KB | Supabase tables |
| `PHASE2_INTELLIGENCE.md` | This file | Documentation |

---

## Questions?

- **Scoring logic unclear?** See `scoring-algorithm.ts` function `scoreBusinessPriority()` for step-by-step walkthrough
- **Want to add a template?** Copy structure in `campaign-templates.ts`, add to library array
- **Thresholds wrong?** Adjust in `SCORING_THRESHOLDS` object
- **Integrate with Phase 1?** See "Integration Checklist" section above
