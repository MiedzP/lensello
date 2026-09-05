# Phase 3: Execution Routing System

## Overview

Phase 3 routes work to the lowest-cost, most-scalable layer that can handle it well. The system automatically assigns actions to the right execution layer based on what type of work needs to be done.

## The Four Execution Layers

```
┌────────────────────────────────────────────────────────────────┐
│                    PHOTOGRAPHER'S VISION                       │
│                      (Strategy & Goals)                        │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  SENIOR STRATEGIST (Fiona)                                     │
│  ├─ Business transformation                                   │
│  ├─ Brand positioning                                         │
│  ├─ Pricing strategy                                          │
│  ├─ Complex diagnosis                                         │
│  ├─ Offer development                                         │
│  ├─ Pivot decisions                                           │
│  └─ Team mentoring                                            │
│  └─ Escalation threshold: 0 days (direct assignment)          │
└────────────────────────────────────────────────────────────────┘
                              ↑
                              │
                         [escalate]
                              │
┌────────────────────────────────────────────────────────────────┐
│  TEAM EXECUTION (Contractors/Staff)                            │
│  ├─ Campaign setup                                            │
│  ├─ Landing page updates                                      │
│  ├─ Content scheduling                                        │
│  ├─ Integration configuration                                 │
│  ├─ Workflow implementation                                   │
│  ├─ CRM updates                                               │
│  └─ Audience segmentation                                     │
│  └─ Escalation threshold: 7 days                              │
└────────────────────────────────────────────────────────────────┘
                              ↑
                              │
                         [escalate]
                              │
┌────────────────────────────────────────────────────────────────┐
│  AI INTELLIGENCE (Claude/LLM)                                  │
│  ├─ Draft campaign copy                                       │
│  ├─ Analyze performance                                       │
│  ├─ Recommend content themes                                  │
│  ├─ Suggest follow-up messages                                │
│  ├─ Identify opportunities                                    │
│  ├─ Generate content variants                                 │
│  └─ Analyze audience data                                     │
│  └─ Escalation threshold: 14 days                             │
└────────────────────────────────────────────────────────────────┘
                              ↑
                              │
                         [escalate]
                              │
┌────────────────────────────────────────────────────────────────┐
│  LENSELLO AUTOMATION (Platform)                                │
│  ├─ Lead capture forms                                        │
│  ├─ Follow-up email sequences                                 │
│  ├─ Nurture campaigns                                         │
│  ├─ Meeting scheduling                                        │
│  ├─ CRM updates                                               │
│  ├─ Workflow automation                                       │
│  └─ Report generation                                         │
│  └─ Escalation threshold: 30 days                             │
└────────────────────────────────────────────────────────────────┘
```

## Routing Decision Flowchart

```
START: New task identified
│
├─ Does it require business judgment or strategic thinking?
│  ├─ YES → SENIOR STRATEGIST ✓
│  │        (business transformation, pricing, positioning, pivots)
│  │
│  └─ NO ↓
│
├─ Does it require complex problem-solving or decision-making?
│  ├─ YES → Could work at different layers (see below)
│  │
│  └─ NO ↓
│
├─ Is it a repeatable, well-defined process?
│  ├─ YES → LENSELLO AUTOMATION ✓
│  │        (lead capture, email sequences, scheduling, workflows)
│  │
│  └─ NO ↓
│
├─ Can an AI system generate a good draft/recommendation?
│  ├─ YES → AI INTELLIGENCE ✓
│  │        (draft copy, analyze data, recommend content, identify opportunities)
│  │        Requires human review before use
│  │
│  └─ NO ↓
│
└─ Does it need human hands to execute?
   └─ YES → TEAM EXECUTION ✓
           (setup, implementation, configuration, scheduling)
           Usually follows AI drafts or strategic decisions


SPECIAL CASES:

Problem: Too complex for AI → Team consults Strategist
Solution: Route to TEAM first, escalate to SENIOR if stuck

Problem: Too many similar tasks for manual handling → Automate
Solution: Start with TEAM pilot, then LENSELLO AUTOMATION build

Problem: Action pending too long → Escalate up
Solution: See Escalation Rules below
```

## Escalation Rules

Actions automatically escalate when they get stuck or blocked:

| Layer | Trigger | Threshold | Escalates To | Reason |
|-------|---------|-----------|--------------|--------|
| **Lensello Automation** | Time | 30 days | AI Intelligence | No progress for a month |
| **AI Intelligence** | Time | 14 days | Team Execution | Draft pending review 2 weeks |
| **AI Intelligence** | Low Confidence | <60% | Team Execution | AI confidence below 60% |
| **Team Execution** | Time | 7 days | Senior Strategist | Task blocked for a week |
| **Team Execution** | Failure | 3 retries | Senior Strategist | Failed 3+ times |
| **Senior Strategist** | Time | ∞ | Fiona's backlog | No escalation; direct assignment |

## Database Schema

### action_queue

Primary work queue. Every action is tracked here.

```sql
CREATE TABLE action_queue (
  id UUID PRIMARY KEY,
  photographer_id UUID NOT NULL,
  
  -- Classification
  action_type action_type NOT NULL,          -- 28 specific action types
  execution_layer execution_layer NOT NULL,  -- 4 layers

  -- Assignment & Status
  assigned_to TEXT,                          -- null | 'lensello' | 'ai' | 'strategist' | email
  status action_status,                      -- pending | in_progress | completed | escalated | cancelled
  priority_level priority_level,             -- red | amber | green

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  context JSONB,                             -- action-specific data

  -- AI Draft
  ai_draft TEXT,                             -- if AI-generated
  ai_draft_metadata JSONB,                   -- confidence, variants, etc.

  -- Escalation
  escalation_reason TEXT,
  escalation_triggered_at TIMESTAMPTZ,
  escalation_threshold_days INT,

  -- Execution
  execution_result JSONB,
  executed_by TEXT,
  executed_at TIMESTAMPTZ,

  -- Timeline
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### action_execution_log

Audit trail of every action's execution history.

```sql
CREATE TABLE action_execution_log (
  id UUID PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES action_queue,
  
  status action_status,
  executed_by TEXT,
  executed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  metadata JSONB
);
```

### dashboard_state

Memoized dashboard metrics, refreshed hourly.

```sql
CREATE TABLE dashboard_state (
  id UUID PRIMARY KEY,
  photographer_id UUID NOT NULL,
  
  -- Quick stats
  new_enquiries_this_month INT,
  consultations_booked_this_month INT,
  bookings_this_month INT,
  pipeline_value_cents INT,
  
  -- Priorities from Phase 2 diagnostic
  top_3_priorities JSONB,        -- [{area, status, insight, recommended_action}]
  
  -- Next recommended action
  recommended_action JSONB,      -- {title, action_type, impact, estimated_time_minutes}
  
  generated_at TIMESTAMPTZ,
  refreshed_at TIMESTAMPTZ
);
```

## Dashboard: Photographer's Marketing HQ

The redesigned dashboard answers three questions immediately:

### 1. "What is happening?" → Quick Stats

```
18 new enquiries this month
6 consultations booked
4 weddings booked
£9,200 pipeline value
```

### 2. "What needs my attention?" → Priorities (Red/Amber/Green)

```
[RED]    Follow up 7 warm enquiries [→ Create nurture campaign]
[RED]    Refresh your Meta creative [→ Generate new variants]
[AMBER]  Publish your venue article [→ Schedule blog post]
```

### 3. "What should I do next?" → Recommended Action

```
You have 23 past enquiries who haven't booked.
Create nurture campaign [→ EXECUTE]
```

The **EXECUTE** button immediately creates an action in the queue, routed to the appropriate layer.

## Action Types (28 Total)

### Lensello Automation (7)
- `auto_lead_capture` - Form submission
- `auto_follow_up_email` - Email sequence
- `auto_nurture_campaign` - Email campaign
- `auto_schedule_reminder` - Reminder
- `auto_crm_update` - CRM sync
- `auto_workflow_trigger` - Automation
- `auto_report_generate` - Report

### AI Intelligence (7)
- `ai_draft_campaign` - Campaign copy
- `ai_analyze_performance` - Analytics
- `ai_recommend_content` - Content ideas
- `ai_suggest_follow_up` - Message draft
- `ai_identify_opportunity` - Opportunity
- `ai_generate_variants` - Content variants
- `ai_audience_analysis` - Audience data

### Team Execution (7)
- `team_setup_campaign` - Campaign config
- `team_landing_page_change` - Page update
- `team_content_schedule` - Schedule posts
- `team_config_integration` - Setup integration
- `team_implement_workflow` - Build workflow
- `team_update_crm` - CRM data
- `team_audience_segment` - Create segments

### Senior Strategist (7)
- `strategy_business_transformation` - Business model
- `strategy_brand_positioning` - Brand strategy
- `strategy_pricing_review` - Pricing
- `strategy_complex_diagnosis` - Deep analysis
- `strategy_offer_development` - New packages
- `strategy_pivot_decision` - Major change
- `strategy_mentoring` - Team coaching

## Implementation Flow

### 1. Dashboard Page Loads
```
dashboard/page.tsx
├─ Fetch dashboard_state from Supabase
├─ Show quick stats (new enquiries, bookings, pipeline)
├─ Show top 3 priorities from Phase 2 diagnostic
├─ Show recommended action with EXECUTE button
└─ Link to phase-specific modules (campaigns, ads, etc.)
```

### 2. User Clicks "EXECUTE"
```
recommended-action-card.tsx
├─ User clicks button
├─ Call executeAction() server action
└─ Action inserted into action_queue
```

### 3. Action Created in Queue
```
actions.ts::executeAction()
├─ Insert row in action_queue
├─ Set execution_layer based on action_type
├─ Set assigned_to based on layer
│  ├─ lensello_automation → assigned_to = 'lensello'
│  ├─ ai_intelligence → assigned_to = 'ai'
│  ├─ team_execution → assigned_to = null (unassigned)
│  └─ senior_strategist → assigned_to = 'strategist'
├─ Set status = 'pending'
└─ Set priority_level from recommendation
```

### 4. Escalation Check (Hourly Cron)
```
/api/cron/check-escalations
├─ Query action_queue for pending actions
├─ For each action:
│  ├─ Calculate days since creation
│  ├─ Compare to escalation_threshold_days
│  └─ If exceeded:
│     ├─ Move to next layer
│     ├─ Update assigned_to
│     ├─ Set escalation_triggered_at
│     └─ Log to action_execution_log
└─ Return count of escalated actions
```

### 5. Dashboard Refresh (Hourly Cron)
```
/api/cron/refresh-dashboard-state
├─ Query clients, gigs, ads for this month
├─ Calculate quick stats
├─ Get top 3 priorities from Phase 2 diagnostic table
├─ Identify top recommended action
├─ Upsert into dashboard_state
└─ Frontend refetches on next page load
```

## TypeScript Types

```typescript
// Main action type
interface Action {
  id: string;
  photographer_id: string;
  action_type: ActionType;           // One of 28 types
  execution_layer: ExecutionLayer;   // One of 4 layers
  assigned_to: string | null;        // Who will handle it
  status: ActionStatus;              // pending | in_progress | completed | escalated | cancelled
  priority_level: PriorityLevel;     // red | amber | green
  title: string;
  description?: string;
  context: Record<string, any>;      // Action-specific data
  ai_draft?: string;                 // If AI-generated
  ai_draft_metadata: {
    confidence?: number;             // 0-1
    variants?: string[];
    alternatives?: Array<{...}>;
  };
  escalation_reason?: string;
  escalation_triggered_at?: string;
  execution_result?: Record<string, any>;
  executed_by?: string;
  executed_at?: string;
  created_at: string;
  updated_at: string;
}

// Dashboard state
interface DashboardState {
  photographer_id: string;
  new_enquiries_this_month: number;
  consultations_booked_this_month: number;
  bookings_this_month: number;
  pipeline_value_cents: number;
  top_3_priorities: Priority[];
  recommended_action: RecommendedAction | null;
}

// Priority (from Phase 2 diagnostic)
interface Priority {
  area: 'position' | 'product' | 'visibility' | 'conversion' | 'nurture' | 'performance';
  status: 'red' | 'amber' | 'green';
  insight: string;
  recommended_action?: {
    title: string;
    action_type: ActionType;
  };
}
```

## File Structure

```
apps/web/src/
├── app/(app)/
│   └── dashboard/
│       ├── page.tsx                     # Main dashboard (redesigned)
│       ├── actions.ts                   # Server actions for routing
│       └── components/
│           ├── priority-card.tsx        # Individual priority display
│           └── recommended-action-card.tsx  # Top action with execute button
│
└── lib/
    └── execution-routing/
        ├── types.ts                     # TypeScript definitions
        └── README.md                    # This file
```

## Integration Points

### Phase 2 → Phase 3
- Phase 2 runs diagnostic framework, outputs `top_3_priorities` to `business_profile`
- Phase 3 reads those priorities and shows them on dashboard
- Phase 3 creates recommended actions based on priorities

### Phase 3 → Future Phases
- Action queue is the single source of truth for all work
- Each layer has own UI/API for managing their queue items
- Escalation rules ensure work doesn't get stuck
- Audit log tracks everything for learning and optimization

## Next Steps After Phase 3

1. **Team Dashboard** - View their assigned actions, update status
2. **AI Workflow** - Run AI actions, generate drafts, wait for review
3. **Automation Executor** - Lensello runs scheduled automations
4. **Performance Tracker** - Measure which layer handles what best
5. **Manual Escalation** - User can force escalate if stuck

---

**Created**: September 2026
**Status**: Phase 3 - Execution & Routing
**Photographer**: Xerensys client (photography business)
**Platform**: Next.js 16 + Supabase
