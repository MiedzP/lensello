# Lensello: Quick Start Testing Guide

**Status:** ✅ Dev server running at `http://localhost:3000`

---

## 🚀 Getting Started

### 1. Login
- **URL:** `http://localhost:3000/local-login`
- **Auto-login:** Click the button (uses demo credentials)
- **Result:** Redirects to dashboard

---

## ✅ Core Features to Test (Tier 1)

### Dashboard
**URL:** `http://localhost:3000/`
- [ ] Page loads without errors
- [ ] Shows 4 key metrics (revenue, bookings, clients, satisfaction)
- [ ] Colors are correct (red/amber/green status indicators)
- [ ] "View Diagnostic" button visible
- [ ] No console errors

### Galleries
**URL:** `http://localhost:3000/galleries`
- [ ] Gallery list displays
- [ ] Can view gallery details
- [ ] Share links work
- [ ] Filtering works (if implemented)

### Campaigns
**URL:** `http://localhost:3000/campaigns`
- [ ] Campaign list shows
- [ ] Can create new campaign (5-step wizard)
- [ ] Step 1: Goal selection works
- [ ] Step 2: Audience builder works
- [ ] Step 3: Template selection works
- [ ] Step 4: Deadline dates work
- [ ] Step 5: Review shows all data
- [ ] Campaign can be launched

### Gigs (Bookings)
**URL:** `http://localhost:3000/gigs`
- [ ] Gig list displays
- [ ] Calendar view works
- [ ] Status filtering works (inquiry, hold, confirmed, completed)
- [ ] Can create/edit gigs
- [ ] Client details show

### Clients
**URL:** `http://localhost:3000/clients`
- [ ] Client list displays
- [ ] Search works
- [ ] Can add new client
- [ ] Client profile shows booking history
- [ ] Notes can be added

### Calendar
**URL:** `http://localhost:3000/calendar`
- [ ] Month view shows
- [ ] Events display
- [ ] Can navigate months
- [ ] Mobile responsive

---

## 📊 Analytics Features to Test (Tier 2)

### Diagnostic
**URL:** `http://localhost:3000/diagnostic`
- [ ] Page loads (just added to navigation)
- [ ] 6 areas display (Position, Product, Visibility, Conversion, Nurture, Performance)
- [ ] Status indicators show (red/amber/green)
- [ ] Insights display
- [ ] Recommendations visible

### Monthly Review
**URL:** `http://localhost:3000/monthly-review`
- [ ] Page loads (just added to navigation)
- [ ] LENS metrics calculate
- [ ] Charts display (if present)
- [ ] Period selector works

### Quarterly Planning
**URL:** `http://localhost:3000/quarterly-planning`
- [ ] Page loads (just added to navigation)
- [ ] Can set goals
- [ ] Can add actions
- [ ] Progress tracking works

### Rhythm (Operating Rhythm)
**URL:** `http://localhost:3000/rhythm`
- [ ] Page loads (just added to navigation)
- [ ] Schedule displays
- [ ] Recommendations show

### Settings
**URL:** `http://localhost:3000/settings`
- [ ] Root page loads (just fixed)
- [ ] Redirects to `/settings/profile`
- [ ] Profile editing works
- [ ] Preferences can be saved

---

## 🎨 Supporting Features (Tier 3)

### Studio
**URL:** `http://localhost:3000/studio`
- [ ] Page loads
- [ ] Creative tools display
- [ ] Can create content (if implemented)

### Library
**URL:** `http://localhost:3000/library`
- [ ] Asset list displays
- [ ] Can upload images
- [ ] Organization works

### Academy
**URL:** `http://localhost:3000/academy`
- [ ] Module list shows
- [ ] Lessons display
- [ ] Progress tracking works

### Ads
**URL:** `http://localhost:3000/ads`
- [ ] Ad list displays
- [ ] Can create ads
- [ ] Status tracking works

### Automations
**URL:** `http://localhost:3000/automations`
- [ ] Workflow list shows
- [ ] Can create automations
- [ ] Triggers display

### Connections
**URL:** `http://localhost:3000/connections`
- [ ] Integration list shows
- [ ] Can connect platforms
- [ ] Status displays

### Conversations
**URL:** `http://localhost:3000/conversations`
- [ ] Inbox displays
- [ ] Messages show
- [ ] Can reply

### Store
**URL:** `http://localhost:3000/store`
- [ ] Product list shows
- [ ] Can manage products
- [ ] Orders display

### Staff
**URL:** `http://localhost:3000/staff`
- [ ] Team list shows
- [ ] Can add staff members
- [ ] Roles display

---

## 🐛 Common Issues & Troubleshooting

### Issue: Page loads slowly (2-5 seconds)
**Expected:** This is normal with Supabase. Will be optimized before production.

### Issue: Console shows errors but page works
**Status:** Type errors don't prevent runtime. Will be fixed soon.

### Issue: Form doesn't submit
**Check:**
1. Look at Network tab in DevTools
2. Check browser console for errors
3. Verify form validation passes
4. Try refreshing and try again

### Issue: Missing data or blank pages
**Check:**
1. Login again (clear cache if needed)
2. Verify Supabase connection in Network tab
3. Check browser console for SQL errors

---

## 📝 What NOT to Test Yet

- **Building for production** - TypeScript errors prevent this (being fixed)
- **Deploying to Vercel** - Wait for clean TypeScript build
- **Performance metrics** - Will optimize in next phase
- **Mobile on all devices** - Focus on desktop first

---

## ✨ What's NEW This Session

- ✅ Added 4 hidden features to navigation (Diagnostic, Monthly-Review, Quarterly-Planning, Rhythm)
- ✅ Fixed Settings root page (was broken)
- ✅ Created type-safe lens framework
- ✅ Updated database types for diagnostic fields
- ✅ Created validators for all enum types
- ✅ Launched dev server with Supabase enabled

---

## 🎯 Next Steps

### Immediate (Today)
1. Test features listed above
2. Fix TypeScript errors (systematic approach)
3. Verify no console errors during testing

### Short-term (This week)
1. Complete TypeScript fixes
2. Optimize performance
3. Deploy to staging
4. Run full test suite

### Medium-term (Before production)
1. User acceptance testing
2. Performance tuning
3. Deploy to production
4. Monitor and iterate

---

## 💬 Feedback

While testing, note:
- Which pages work well
- Which pages have issues
- What's confusing or missing
- Performance concerns
- UI/UX improvements

Use these observations to prioritize improvements!

---

## 📊 Success Criteria

**By end of today:**
- [ ] 0 TypeScript compilation errors
- [ ] All 20 features accessible
- [ ] No console errors when using features
- [ ] Can complete full workflow (create campaign → measure results)

**By end of week:**
- [ ] All features tested thoroughly
- [ ] Performance optimized (<2s page loads)
- [ ] Deployed to production

