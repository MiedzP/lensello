# Lensello Platform - Manual Testing Guide
**Start Time:** Right now!  
**Dev Server:** Starting on localhost:3000

---

## 🚀 Quick Start

1. **Wait 10 seconds** for dev server to start
2. **Open:** `http://localhost:3000/local-login`
3. **Start testing** (no authentication required)

---

## 📋 Test Checklist

### TEST A: Local Login Page
**URL:** `http://localhost:3000/local-login`

**What to look for:**
- [ ] Page loads (no blank white screen)
- [ ] Shows "Lensello - Local Development"
- [ ] Shows navigation links to:
  - [ ] Dashboard
  - [ ] Onboarding
  - [ ] Create Campaign
  - [ ] View Monthly Review
  - [ ] View Quarterly Planning
  - [ ] View Operating Rhythm
- [ ] Test credentials shown: michael.pagano@xerensys.ai / Lensello2026

**Expected:** Clean page with 6 navigation buttons

---

### TEST B: Dashboard
**URL:** `http://localhost:3000/dashboard`

**What to look for:**
- [ ] Page title: "Good morning, Photographer"
- [ ] "View Diagnostic" button in top right
- [ ] **4 Key Metrics displayed:**
  - [ ] Enquiries: 18
  - [ ] Bookings: 6
  - [ ] Conversion: 33%
  - [ ] Pipeline: £9,200
- [ ] **Priorities section with 3 items:**
  - [ ] 🔴 RED item
  - [ ] 🟠 AMBER item
  - [ ] 🟢 GREEN item
- [ ] **Opportunity section** with past enquiries count
- [ ] Links working on all priority items

**Expected:** Full dashboard with metrics and priorities

---

### TEST C: Create Campaign (CRITICAL TEST)
**URL:** `http://localhost:3000/campaigns/new`

**This tests the complete 5-step workflow including NEW deadline feature.**

#### Step 1: What do you want more of?
- [ ] Page shows photography type options
- [ ] Options include: Weddings, Engagements, Portraits, etc.
- [ ] **Select:** Weddings
- [ ] "Next" button appears and works
- **Console Check:** Look for: `"handleNext called with data from step: what"`

#### Step 2: What's your priority?
- [ ] Page shows priority options
- [ ] Options are wedding-specific
- [ ] **Select:** "Higher-value weddings"
- [ ] "Back" and "Next" buttons work
- **Console Check:** Look for: `"Updated campaignData: { ..., priority: 'Higher-value' }"`

#### Step 3: Which channels?
- [ ] Checkboxes for: Meta, Instagram, Email, Direct, etc.
- [ ] **Select:** Meta and Instagram (check both)
- [ ] "Back" and "Next" buttons work
- **Console Check:** Look for: `"Updated campaignData: { ..., channels: ['meta', 'instagram'] }"`

#### Step 4: When will it run? 🆕 (NEW DEADLINE FEATURE)
**This is the critical test for the deadline persistence issue**

- [ ] Page shows: "Set Campaign Timeline"
- [ ] Two date picker fields:
  - [ ] Campaign Start Date
  - [ ] Campaign End Date
- [ ] **Enter dates:**
  - Start: Pick any date in the next 7 days
  - End: Pick 7 days after start
- [ ] **Verify:**
  - [ ] Duration displays (e.g., "7 days")
  - [ ] Date validation works (if you try end before start, error shows)
- [ ] Quick options visible (1 week, 2 weeks, 1 month, 1 quarter)
- [ ] Try clicking "1 week" button - should auto-fill dates
- [ ] "Back" and "Next" buttons work

**🔴 CRITICAL - Console Check:**
```
Look for EXACTLY these log messages:

1. "StepDeadline calling onNext with: {
     startDate: "YYYY-MM-DD",
     endDate: "YYYY-MM-DD",
     starts_on: "YYYY-MM-DD",
     ends_on: "YYYY-MM-DD"
   }"

2. "handleNext called with data from step: deadline"

3. "Updated campaignData: { 
     photographyType: "Weddings",
     priority: "Higher-value",
     channels: ['meta', 'instagram'],
     startDate: "YYYY-MM-DD",
     endDate: "YYYY-MM-DD",
     ...
   }"
```

**If you DON'T see these logs:** The dates are getting lost!

#### Step 5: Review & Launch
- [ ] Page shows all campaign details:
  - [ ] What: Weddings
  - [ ] Priority: Higher-value
  - [ ] Channels: Meta, Instagram
  - [ ] **Starts: [Your start date]** ← KEY
  - [ ] **Ends: [Your end date]** ← KEY
  - [ ] Status: Ready to launch
- [ ] "What Lensello Will Build" section shows:
  - [ ] Email Sequence
  - [ ] Landing Page
  - [ ] Campaign Brief
  - [ ] Meta Ad Creative
- [ ] "Launch Campaign" button

**🔴 CRITICAL - Before clicking Launch:**
Check browser console for:
```
"Campaign data being sent: {
  photographyType: "Weddings",
  priority: "Higher-value",
  channels: ['meta', 'instagram'],
  startDate: "YYYY-MM-DD",     ← Must be present!
  endDate: "YYYY-MM-DD",       ← Must be present!
}"
```

#### Click "Launch Campaign"
- [ ] One of these happens:
  - **✅ Success:** Redirects to /campaigns, shows "Campaign created"
  - **❌ Error:** Shows error message (screenshots!)

**Console will show:**
```
"createCampaign received data: {
  keys: [...],
  photographyType: "Weddings",
  priority: "Higher-value",
  channels: ['meta', 'instagram'],
  startDate: "YYYY-MM-DD",     ← Check if present or undefined!
  endDate: "YYYY-MM-DD",       ← Check if present or undefined!
  starts_on: "YYYY-MM-DD",     ← Check if present or undefined!
  ends_on: "YYYY-MM-DD",       ← Check if present or undefined!
}"
```

**If dates are undefined:** This identifies the persistence issue!

---

### TEST D: Marketing Diagnostic (NEW)
**URL:** `http://localhost:3000/diagnostic`

**What to look for:**
- [ ] Page title: "Marketing Diagnostic"
- [ ] Subtitle: "Your 6-area business assessment"
- [ ] Summary cards showing:
  - [ ] Red count (X)
  - [ ] Amber count (Y)
  - [ ] Green count (Z)

**6 Diagnostic Areas - each should show:**
- [ ] Icon (🔴 or 🟠 or 🟢)
- [ ] Area name (POSITION, PRODUCT, VISIBILITY, CONVERSION, NURTURE, PERFORMANCE)
- [ ] Area description
- [ ] Status label ("Action needed" / "Improvement needed" / "Performing well")
- [ ] Insight text explaining the status
- [ ] "What we're assessing:" checklist with bullets
- [ ] Recommended action in a box

**Verify sorting:**
- [ ] RED areas appear first
- [ ] AMBER areas in middle
- [ ] GREEN areas last

**Expected:** All 6 areas displayed with proper styling and information

---

### TEST E: Dashboard → Diagnostic Link
**From:** Dashboard page  
**Action:** Click "View Diagnostic" button (top right)

- [ ] Navigates to /diagnostic
- [ ] Diagnostic page loads correctly

---

## 🔍 Browser Console Guide

**To open console:**
- Windows/Linux: `F12` or `Ctrl+Shift+I`
- Mac: `Cmd+Option+I`
- Go to "Console" tab

**Key logs to look for:**
1. When completing Step 4 (deadline):
   - `"StepDeadline calling onNext with:"`
   
2. When clicking Next from Step 4:
   - `"handleNext called with data from step: deadline"`
   - `"Updated campaignData:"`

3. When clicking Launch Campaign:
   - `"Campaign data being sent:"`
   - `"createCampaign received data:"`

**If you see these logs, the code is working.**

---

## 🚨 Expected Issues & Solutions

### Issue 1: Blank white page
- **Cause:** Dev server still starting
- **Solution:** Wait 20 seconds, refresh browser

### Issue 2: 404 on /campaigns/new
- **Cause:** Page not created
- **Solution:** Check that the file exists
  - Should be at: `apps/web/src/app/(app)/campaigns/new/page.tsx`

### Issue 3: Campaign creation fails with "date required" error
- **Cause:** Dates not persisting
- **Solution:** 
  1. Check browser console for logs
  2. See which step shows undefined dates
  3. Report which log is missing

### Issue 4: Diagnostic page shows blank areas
- **Cause:** Database migration not applied
- **Solution:** That's expected - mock data is shown

---

## 📝 What to Report Back

**When complete, please share:**

1. **Campaign Creation Test Results:**
   - Did all 5 steps load?
   - Did dates display in Step 5 review?
   - Did campaign create successfully or fail?
   - Error message if failed?

2. **Browser Console Logs:**
   - Copy the logs from console (F12)
   - Paste into your response
   - This helps identify where dates are lost

3. **Diagnostic Page:**
   - Did it load?
   - Were all 6 areas visible?
   - Did colors display correctly?

4. **Overall Assessment:**
   - What works well?
   - What needs fixing?
   - Any unusual behavior?

---

## ⏱️ Time Estimate

- Setup: 30 seconds
- Local login test: 1 minute
- Dashboard test: 2 minutes
- Campaign creation (5 steps): 5 minutes
- Diagnostic test: 2 minutes
- **Total: ~10 minutes**

---

## 🎯 Most Critical Test

**The deadline feature (TEST C, Step 4)** is the priority.

**Success criteria:**
1. ✅ Dates can be entered
2. ✅ Dates display in Step 5
3. ✅ Campaign creates successfully with dates

**If deadline fails:**
- Check console logs to pinpoint where dates are lost
- Provide the exact error message
- Include console output

---

**Ready? Open:** `http://localhost:3000/local-login`

**Let me know what you find!**
