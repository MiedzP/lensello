# Lensello Platform - Testing Workflow
**Date:** August 28, 2026  
**Status:** Running comprehensive tests

---

## 🔍 Pre-Testing Status

### Compilation
✅ **TypeScript:** Fixed remaining errors
- Diagnostic page casting for unmigrated columns  
- Dashboard Link href type safety
- Ready for dev server

### Dev Server
✅ **Running on:** `localhost:3000`
✅ **Status:** Serving correctly
✅ **Redirects:** `/auth/signin` → Proper auth flow

---

## 📋 Complete Workflow Test Plan

### Test 1: Local Login (No Auth Required)
**Path:** `GET /local-login`
**Expected:** 
- Navigation page with test links
- Links to all major sections
- No Supabase auth required

**Components to Test:**
- Dashboard link
- Onboarding link
- Campaign creation link
- Diagnostic link
- Monthly review link
- Quarterly planning link

---

### Test 2: Dashboard Workflow
**Path:** `GET /dashboard`
**Expected:**
- Greeting with photographer name
- 4 key metrics (enquiries, bookings, conversion, pipeline)
- Red/Amber/Green priorities (3 items)
- Opportunity section
- "View Diagnostic" button
- Links to campaigns, clients, etc.

**Test Data:**
- Photographer name: "Fiona Cermak"
- Enquiries: 18
- Bookings: 6
- Conversion: 33%
- Pipeline: £9,200

**Data Flow:**
1. ✅ Dashboard page loads
2. ✅ Business profile fetched
3. ✅ Metrics calculated
4. ✅ Priorities generated
5. ✅ Button to diagnostic visible

---

### Test 3: Campaign Creation Flow (Full 5-Step)
**Path:** `POST /campaigns/new` → Create campaign

**Step 1: What do you want more of?**
- Photography type selector
- Options: Weddings, Engagements, Portraits, Families, Newborns, Commercial, etc.
- Select: "Weddings"
- ✅ Data persists in state
- Next button works

**Step 2: What's your priority?**
- Category-specific objectives shown
- Options based on "Weddings": More enquiries, Higher-value, Destination, Fill dates, etc.
- Select: "Higher-value weddings"
- ✅ Data persists in state
- Next button works

**Step 3: Which channels?**
- Multi-select channel options
- Options: Meta, Instagram, Email, Direct, Pinterest, TikTok
- Select: Meta, Instagram
- ✅ Data persists in state
- ✅ Verify array is stored correctly
- Next button works

**Step 4: When will it run? (NEW DEADLINE FEATURE)**
- Date picker for start date
- Date picker for end date
- Validation:
  - ✅ Start date required
  - ✅ End date required
  - ✅ End after start
  - ✅ Not in past
- Quick options: 1 week, 2 weeks, 1 month, 1 quarter
- Duration display shows days
- ✅ **CRITICAL:** Dates persist in state
- Back/Next navigation works

**Step 5: Review & Launch**
- Shows: What, Priority, Channels, Start date, End date, Status
- ✅ All data from 5 steps visible
- ✅ Dates display correctly
- Launch button triggers createCampaign
- ✅ Error handling shows specific errors
- ✅ Success redirects to /campaigns

**Data Validation:**
- [ ] Campaign created in database
- [ ] starts_on and ends_on saved
- [ ] Campaign brief includes timeline
- [ ] User can see created campaign

---

### Test 4: Marketing Diagnostic Framework (NEW)
**Path:** `GET /diagnostic`
**Expected:**
- 6-area assessment displayed
- Each area shows: Name, Icon (🔴/🟠/🟢), Status, Insight
- Summary counts (X Red, Y Amber, Z Green)
- Areas sorted by severity (red first)
- "What's being diagnosed" checklist visible
- Recommended actions shown

**6 Areas to Verify:**
1. ✅ POSITION - Brand, differentiation, ideal client, authority
2. ✅ PRODUCT - Packages, pricing, profitability
3. ✅ VISIBILITY - SEO, social, venues, Meta, Google
4. ✅ CONVERSION - Website, enquiry journey, consultations
5. ✅ NURTURE - CRM, follow-up, email, remarketing
6. ✅ PERFORMANCE - Leads, bookings, conversion, revenue

**Mock Data Expected:**
- RED areas: 1-2 (Nurture, possibly another)
- AMBER areas: 2-3
- GREEN areas: 1-2

**Status Indicators:**
- Red icon: 🔴 "Action needed"
- Amber icon: 🟠 "Improvement needed"
- Green icon: 🟢 "Performing well"

---

### Test 5: Dashboard Diagnostic Link
**Path:** Dashboard → "View Diagnostic" button
**Expected:**
- Button visible in greeting area
- Clicking navigates to /diagnostic
- Diagnostic page loads correctly

---

## 🐛 Known Issues to Track

### Issue #1: Campaign Deadline Data Loss
**Status:** Under investigation
**Symptom:** Date fields undefined when creating campaign
**Debug Logs Added:** 
- Campaign builder logs campaignData before sending
- Action logs received data with all fields
- Step deadline logs onNext call
**Next Step:** Check browser console output from test run

### Issue #2: TypeScript Types for Diagnostic
**Status:** Workaround applied
**Reason:** Database migration not applied to live database
**Solution:** Cast to `any` for now
**Next Step:** Apply migration to Supabase, regenerate types

### Issue #3: Browser Automation
**Status:** Extension not available
**Solution:** Testing via curl, code analysis, and manual verification

---

## ✅ Test Results (To Be Filled)

### Compilation Status
```
npm run typecheck
Status: [ ] PASS [ ] FAIL (2 warnings remain in pre-existing code)
Notes: ___________________
```

### Local Login Page
```
URL: http://localhost:3000/local-login
Load: [ ] OK [ ] FAIL
Links visible: [ ] All [ ] Some [ ] None
Notes: ___________________
```

### Dashboard Load
```
URL: http://localhost:3000/dashboard
Load: [ ] OK [ ] FAIL
Greeting: [ ] Visible
Metrics: [ ] All 4 showing
Priorities: [ ] Red/Amber/Green visible
Diagnostic button: [ ] Visible
Notes: ___________________
```

### Campaign Creation - Full Flow
```
Step 1 (What): [ ] PASS [ ] FAIL
Step 2 (Priority): [ ] PASS [ ] FAIL
Step 3 (Channels): [ ] PASS [ ] FAIL
Step 4 (Deadline): [ ] PASS [ ] FAIL (Critical - dates persist?)
Step 5 (Review): [ ] PASS [ ] FAIL
Create action: [ ] PASS [ ] FAIL
Dates saved: [ ] YES [ ] NO [ ] Unknown

Error if dates missing: "Campaign start date is required"
Expected error message at launch
```

### Diagnostic Page
```
URL: http://localhost:3000/diagnostic
Load: [ ] OK [ ] FAIL
6 areas visible: [ ] All [ ] Some [ ] None
Icons (🔴🟠🟢): [ ] Correct [ ] Mixed [ ] Missing
Insights shown: [ ] All [ ] Some [ ] None
"What's diagnosed": [ ] Visible [ ] Missing
Next steps section: [ ] Visible [ ] Missing
Notes: ___________________
```

---

## 📊 Feature Completeness

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard greeting | ✅ Built | Shows photographer name |
| Key metrics (4) | ✅ Built | Enquiries, bookings, conversion, pipeline |
| Red/Amber/Green priority | ✅ Built | Mock data provided |
| Opportunity section | ✅ Built | Shows past enquiries |
| Campaign builder 4-step | ✅ Built | Outcome-first flow |
| Campaign deadline selector | ✅ Built | Date picker + validation |
| Campaign deadline persistence | 🔴 Unknown | Needs testing |
| Campaign deadline save to DB | 🔴 Unknown | Needs verification |
| Diagnostic 6-area framework | ✅ Built | POSITION/PRODUCT/VISIBILITY/CONVERSION/NURTURE/PERFORMANCE |
| Diagnostic Red/Amber/Green | ✅ Built | Status colors and icons |
| Diagnostic insights | ✅ Built | Explanatory text for each area |
| Diagnostic recommendations | ✅ Built | Action items for each area |
| Dashboard → Diagnostic link | ✅ Built | "View Diagnostic" button |
| Expanded photo categories | ❌ Not yet | Next: Add all 11 types |
| Weekly priorities view | ❌ Not yet | Next: Extract top 3 items |
| AI recommendation layer | ❌ Not yet | Next: Wire to Anthropic API |

---

## 🎯 Next Actions After Testing

### If All Tests Pass ✅
1. Document what works perfectly
2. Create user documentation
3. Deploy to Vercel
4. Move to Phase 2 (expanded categories)

### If Issues Found 🔴
1. **Campaign deadline issue:** Debug date persistence
2. **Diagnostic columns:** Apply migration to Supabase
3. **TypeScript errors:** Regenerate types after migration
4. **Other issues:** Document and prioritize

---

## 📝 Testing Notes

### Test Run 1
Date: ________________  
Tester: ________________  
Environment: Dev (localhost:3000)  
Results: ________________

### Test Run 2
Date: ________________  
Tester: ________________  
Environment: Dev (localhost:3000)  
Results: ________________

---

**Test Status:** 🟡 In Progress  
**Last Updated:** 2026-08-28  
**Next Review:** After automated test completion
