# Lensello Platform: Ground-Up Redesign Plan

**Date Started:** August 28, 2026  
**Backup Location:** `C:\Users\mcpag\lensello-backups\backup_[timestamp]`  
**Status:** IN PROGRESS

---

## 🎯 Redesign Principles

1. **Photography-First**: Every feature must serve photographer workflows
2. **Simplicity Over Features**: Remove complexity, keep only what matters
3. **Performance First**: Sub-1s page loads (dev: <2s with Supabase)
4. **Type-Safe**: Zero TypeScript errors, proper types everywhere
5. **User-Focused**: Clear navigation, obvious workflows, minimal clicks
6. **Data-Driven**: Every decision grounded in actual usage patterns

---

## 📋 Phase 1: Analysis & Planning

### Tasks:
- [ ] Complete codebase analysis
- [ ] Identify dead code and unused features
- [ ] Map current database schema to business needs
- [ ] Review Fiona's feedback and requirements
- [ ] Create prioritized feature roadmap

**Status:** RUNNING (agent-a6ce10d9)

---

## 📋 Phase 2: Core Architecture Redesign

### Goals:
- [ ] Simplify database schema (remove unnecessary columns)
- [ ] Establish clear component hierarchy
- [ ] Define server/client boundaries clearly
- [ ] Create reusable component library
- [ ] Fix all TypeScript errors

### Files to Redesign:
- Database migrations (schema cleanup)
- Core layouts and navigation
- Authentication flow
- Data fetching patterns
- Error handling

---

## 📋 Phase 3: Feature Prioritization

### Tier 1 (Core - Must Have):
- [ ] Dashboard (photography business overview)
- [ ] Galleries (client work showcase)
- [ ] Campaigns (marketing push automation)
- [ ] Gigs (booking management)
- [ ] Clients (relationship management)

### Tier 2 (Important - Should Have):
- [ ] Diagnostic (business health assessment)
- [ ] Calendar (schedule overview)
- [ ] Analytics (performance measurement)

### Tier 3 (Nice-to-Have - Could Have):
- [ ] Studio (creative tools)
- [ ] Automations (workflow builder)
- [ ] Academy (learning content)

---

## 📋 Phase 4: Component Redesign

### New Component Structure:
```
components/
├── core/                 # Reusable primitives
│   ├── Button
│   ├── Card
│   ├── Form
│   └── Table
├── features/            # Feature-specific components
│   ├── dashboard/
│   ├── campaigns/
│   ├── galleries/
│   └── gigs/
└── layouts/            # Page layouts
    ├── AppLayout
    ├── AuthLayout
    └── PageHeader
```

---

## 📋 Phase 5: Database Optimization

### Schema Improvements:
- [ ] Remove unused columns
- [ ] Consolidate related tables
- [ ] Optimize RLS policies
- [ ] Add proper indexes
- [ ] Create helpful views

---

## 📋 Phase 6: Testing & Verification

### Tests:
- [ ] TypeScript compilation (0 errors)
- [ ] All routes load (<2s locally)
- [ ] All features work end-to-end
- [ ] No console errors
- [ ] Mobile responsive

---

## 📋 Phase 7: Deployment

### Before Deploy:
- [ ] Apply all migrations
- [ ] Test in staging
- [ ] Verify Vercel build
- [ ] Check performance metrics
- [ ] Document changes

---

## 📝 Notes

- **Backup Created:** YES - Full project backed up before changes
- **Server State:** Running with Supabase enabled
- **Current Issues:** Protected routes working, performance acceptable
- **Next Step:** Await analysis results, then begin Phase 2

---

## 🔄 Rollback Instructions

If anything breaks:
1. Stop dev server: `taskkill /PID [pid] /F`
2. Delete modified project: `rm -r C:\Users\mcpag\lensello`
3. Copy backup: `cp -r C:\Users\mcpag\lensello-backups\backup_[timestamp] C:\Users\mcpag\lensello`
4. Restart dev: `npm run dev`

