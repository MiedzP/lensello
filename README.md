# Lensello Platform

**Photography business operations platform** | Next.js • Supabase • TypeScript

A complete business management system for photography professionals. Lensello helps photographers identify what's happening in their business, recommend marketing actions, execute campaigns, measure results, and learn from data.

---

## 🎯 Platform Overview

Lensello operates around a core loop: **IDENTIFY → RECOMMEND → EXECUTE → MEASURE → LEARN**

### Integrated Modules

**Core Photo Business Features:**
1. **📸 Library** — Photo management, asset organization, gallery creation
2. **🎬 Studio** — AI-powered creative studio for marketing assets
3. **📅 Gigs** — Booking calendar, contract management, payment tracking
4. **👥 Clients** — CRM and communication inbox for client management
5. **📢 Campaigns** — Marketing campaigns, execution, and tracking

**Business Operations Layer (NEW):**
6. **📊 Dashboard** — Marketing HQ showing metrics, priorities, and opportunities
7. **🎨 Campaign Builder** — Goal-first campaign orchestration (outcome-led, not tool-led)
8. **📈 Monthly Review** — LENS measurement framework analysis and insights
9. **📋 Quarterly Planning** — 90-day strategy and seasonal opportunity planning
10. **⏰ Operating Rhythm** — Daily, weekly, monthly, quarterly operating cadence
11. **⚙️ Settings** — Business profile and integration management

---

## 📁 Repository Structure

```
lensello/
├── apps/web/                              # Main Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/                   # Authentication
│   │   │   │   └── onboarding/           # Photography business setup
│   │   │   ├── (app)/                    # Main platform (auth-protected)
│   │   │   │   ├── dashboard/            # Marketing HQ
│   │   │   │   ├── campaigns/            # Campaign management
│   │   │   │   ├── monthly-review/       # LENS analysis
│   │   │   │   ├── quarterly-planning/   # Strategy planning
│   │   │   │   ├── rhythm/               # Operating cadence
│   │   │   │   ├── settings/             # Profile configuration
│   │   │   │   ├── library/              # Photo library
│   │   │   │   ├── studio/               # Creative studio
│   │   │   │   ├── gigs/                 # Bookings
│   │   │   │   ├── clients/              # CRM
│   │   │   │   └── ...                   # Other modules
│   │   │   ├── api/                      # API routes
│   │   │   ├── admin/                    # Admin panel
│   │   │   ├── local-login/              # Dev testing (no auth)
│   │   │   └── ...                       # Public pages
│   │   ├── lib/
│   │   │   ├── lens/                     # LENS scoring & priority engine
│   │   │   ├── auth.ts                   # Authentication
│   │   │   ├── db.types.ts               # Supabase types
│   │   │   └── ...                       # Other utilities
│   │   └── components/                   # Shared components
│   └── package.json
│
├── packages/core/                         # Shared domain logic
│   ├── src/
│   │   ├── integrations/                 # Third-party adapters
│   │   ├── types/                        # Shared types
│   │   └── prompts/                      # AI prompts
│   └── package.json
│
├── supabase/
│   └── migrations/                        # Database schema (SQL)
│
├── AGENTS.md                              # Code conventions
├── PLATFORM_STRUCTURE_AUDIT.md            # Feature audit (A grade)
├── BUILD_SUMMARY.md                       # Recent changes
├── DEPLOYMENT_GUIDE.docx                  # Deployment instructions
├── DEPLOYING.md                           # Quick deployment
└── README.md                              # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Supabase account
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/lensello/lensello.git
cd lensello

# Install dependencies
npm install

# Configure environment
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local with your Supabase credentials

# Apply database migrations
supabase login
supabase link --project-ref <your-project-ref>
supabase db push

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Local Testing (No Auth Required)

For quick testing without Supabase:

```bash
npm run dev
# Navigate to http://localhost:3000/local-login
# Use test credentials shown on page
```

---

## 🔧 Environment Variables

**Required:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Optional:**

```env
ANTHROPIC_API_KEY=sk-ant-...           # For AI features
NEXT_PUBLIC_GA_ID=G-XXXXXXXX           # Google Analytics
LENSELLO_INTEGRATION_MODE=mock          # mock (default) or live
```

⚠️ **Important:** Environment file must be at `apps/web/.env.local`

---

## 🎨 Key Features

### Dashboard (Marketing HQ)
- **Metrics:** Enquiries, bookings, conversion rate, pipeline
- **Priorities:** Red/Amber/Green system
- **Opportunities:** Growth areas
- **Recommendations:** Suggested actions

### Campaign Builder (Goal-First)
- Step 1: What outcome do you want?
- Step 2: What's your priority?
- Step 3: Which channels?
- Step 4: Review & launch

### LENS Measurement Framework

| Pillar | Question | Measures |
|--------|----------|----------|
| **LEAD** | Are enough clients discovering you? | Lead volume, visibility |
| **ELEVATE** | Does the brand justify the price? | Portfolio, reviews |
| **NURTURE** | Are enquiries becoming clients? | Conversion rate, response |
| **SCALE** | Is the business profitable and growing? | Profit margin, capacity |

### Monthly Review
- LENS scores for all pillars
- Campaign performance
- Key insights

### Quarterly Planning
- 90-day objectives
- Seasonal opportunities
- Channel strategy
- Resource allocation

### Operating Rhythm
- **Daily:** Capture leads
- **Weekly:** Review priorities, take 3 actions
- **Monthly:** Analyze LENS, adjust strategy
- **Quarterly:** Plan 90-day direction

---

## 📝 Development Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm run test             # Unit tests
npm run test:e2e         # E2E tests

# Database
npm run db:types         # Regenerate types from Supabase
```

---

## 🚢 Deployment

### To Vercel

```bash
vercel login
vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
```

---

## 📚 Documentation

- **`PLATFORM_STRUCTURE_AUDIT.md`** — Feature completeness checklist
- **`BUILD_SUMMARY.md`** — Recent changes and notes
- **`DEPLOYING.md`** — Deployment guide
- **`AGENTS.md`** — Code conventions
- **`supabase/migrations/`** — Database schema

---

## 🎯 Design Philosophy

### Five Product Rules

1. **Don't make photographers interpret data** — Red/Amber/Green translates metrics to actions
2. **Remove work when possible** — Dashboard surfaces priorities automatically
3. **Prioritize outcomes over modules** — Ask "What do you want?" not "Which channels?"
4. **Use photography-specific logic** — Categories, booking patterns, seasonal opportunities
5. **Build around identify → recommend → execute → measure → learn** — Full cycle

---

## 🔌 Integrations (Framework Ready)

| Service | Purpose | Status |
|---------|---------|--------|
| **Meta/Facebook** | Ad campaigns, content | Mock adapter |
| **Google** | Search ads, analytics | Mock adapter |
| **Instagram** | Content publishing | Mock adapter |
| **Gmail/Google Workspace** | Email, calendar | Mock adapter |
| **Stripe** | Payment processing | Mock adapter |

See `packages/core/src/integrations/` for adapter architecture.

---

## 🤝 Contributing

### Before Writing Code

Read **`AGENTS.md`** for conventions on:
- File structure and naming
- Component patterns
- Server vs. client code
- State management

### Workflow

1. Create feature branch: `git checkout -b feat/your-feature`
2. Follow `AGENTS.md` conventions
3. Test locally: `npm run dev`
4. Typecheck: `npm run typecheck`
5. Lint: `npm run lint`
6. Commit: `git commit -m "feat: description"`
7. Push: `git push origin feat/your-feature`

---

## ⚠️ Known Limitations

- No automatic post scheduling (requires manual publish)
- No EXIF date extraction (manual capture dates)
- No AI image alt text (manual descriptions)
- Mock payment settlement (Stripe is mocked)
- No pagination UI (lists capped at 60-200 items)
- Signed URLs re-optimize images on each load

---

## 🐛 Troubleshooting

### Dev server won't start

```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Clear build cache
rm -rf .next

# Restart
npm run dev
```

### Supabase connection errors

```bash
# Verify env vars
cat apps/web/.env.local

# Check Supabase
supabase status
```

### TypeScript errors after schema changes

```bash
npm run db:types
npm run typecheck
```

---

## 📞 Support

- Read `AGENTS.md` for code conventions
- Check `PLATFORM_STRUCTURE_AUDIT.md` for feature status
- Review migrations for database changes
- Check GitHub issues for known problems

---

## 📄 License

[License TBD]

---

## 👤 Built For

**Photography professionals** who want to:
- Manage their entire business in one place
- Make data-driven marketing decisions
- Scale without losing quality
- Keep operations simple and focused

**Created:** August 2026  
**Platform Status:** v1.0 complete and tested

---

**Ready to get started?** See **Quick Start** above or check **DEPLOYING.md**.
