# Timeline Engine - Automated Scheduling System

The Timeline Engine is the **core scheduling system** for Xerensys Lensello, enabling photographers to automate multi-step client workflows and campaigns. It powers automated timelines from initial booking through delivery, with deep integration to Phase 3 execution routing.

## Architecture Overview

### System Flow

```
Timeline Template → Start Timeline → Scheduled Timeline
    ↓                                      ↓
Milestones                          Scheduled Actions (pending)
    ↓                                      ↓
Milestone Actions                   Cron Job (hourly)
    ↓                                      ↓
Action Types                        Due Actions (prepared)
(email, task, SMS, etc.)                  ↓
                                   Queue to action_queue
                                          ↓
                                   Phase 3 Execution Routing
                                   (automation, AI, team, strategist)
```

### Core Tables

- **timeline_templates**: Reusable workflow templates (Wedding, Engagement, Follow-up, Campaign)
- **timeline_milestones**: Individual steps in a timeline (day 0, day 3, day 14, etc.)
- **milestone_actions**: Specific tasks at each milestone (send email, create task, SMS, etc.)
- **scheduled_timelines**: Active instances of templates for specific clients/projects
- **scheduled_actions**: Queue of actions to execute (fed by cron job to action_queue)
- **action_triggers**: Conditions that auto-start timelines (booking confirmed, payment received, etc.)

### Key Concepts

#### Template Category
- `photography_workflow` — Wedding, Portrait, Event, etc.
- `client_journey` — New Lead, Past Client Reactivation, etc.
- `campaign_cycle` — Meta Campaign, Email Sequence, etc.
- `custom` — User-defined templates

#### Day Calculation Mode
- `calendar_days` — Absolute days from start (day 0, day 3, day 14)
- `business_days` — Exclude weekends (Mon-Fri only)
- `relative_to_previous` — Days after previous milestone completion

#### Timeline Status
- `draft` — Not yet active
- `active` — Currently running
- `paused` — Temporarily stopped
- `completed` — All milestones done
- `cancelled` — Abandoned

#### Action Routing
All actions created by the timeline engine are queued to `action_queue` with:
- `execution_layer` = `lensello_automation` (default for timeline actions)
- `action_type` = from milestone action configuration
- `status` = `pending` → ready for Phase 3 routing

## Usage Guide

### 1. Create a Timeline Template

```typescript
import { createTimelineTemplate } from '@/lib/scheduling';

const template = await createTimelineTemplate(photographerId, {
  slug: 'wedding-timeline',
  name: 'Wedding Photography Timeline',
  description: 'Complete workflow from engagement to album delivery',
  category: 'photography_workflow',
  duration_days: 60,
  timezone: 'America/New_York',
});
```

### 2. Add Milestones to Template

```typescript
import { addMilestone } from '@/lib/scheduling';

// Day 0: Engagement session confirmation
const engagement = await addMilestone({
  template_id: template.id,
  position: 0,
  title: 'Engagement Session Confirmation',
  description: 'Confirm engagement shoot details and send prep guide',
  day_number: 0,
  day_calc_mode: 'calendar_days',
  preferred_time: '09:00:00',
});

// Day 14: Wedding day details
const wedding = await addMilestone({
  template_id: template.id,
  position: 1,
  title: 'Wedding Day Details',
  description: 'Confirm wedding day timeline and details',
  day_number: 14,
  day_calc_mode: 'calendar_days',
  preferred_time: '09:00:00',
});

// Day 30: Album delivery
const delivery = await addMilestone({
  template_id: template.id,
  position: 2,
  title: 'Album Delivery',
  description: 'Deliver full gallery and albums',
  day_number: 30,
  day_calc_mode: 'calendar_days',
});
```

### 3. Add Actions to Milestones

```typescript
import { addAction } from '@/lib/scheduling';

// Email action at day 0
const action1 = await addAction({
  milestone_id: engagement.id,
  action_type: 'auto_follow_up_email',
  priority_level: 'red',
  title: 'Send Engagement Shoot Details',
  description: 'Confirm shoot location, time, and attire recommendations',
  template_content: `Hi {{client_name}},

We're excited for your engagement session on {{session_date}}!

Location: {{location}}
Time: {{time}}
What to wear: See attached guide

See you soon!`,
  template_variables: ['client_name', 'session_date', 'location', 'time'],
  action_config: {
    email: {
      subject: 'Engagement Session Details - {{event_date}}'
    }
  },
});

// Email action at day 14
const action2 = await addAction({
  milestone_id: wedding.id,
  action_type: 'auto_follow_up_email',
  priority_level: 'red',
  title: 'Wedding Day Confirmation',
  description: 'Final confirmation of wedding day logistics',
  template_content: `Hi {{client_name}},

We're excited for your wedding on {{wedding_date}}!

Ceremony: {{ceremony_time}}
Location: {{location}}
Timeline: [attached schedule]

...`,
  template_variables: ['client_name', 'wedding_date', 'ceremony_time', 'location'],
});
```

### 4. Start a Timeline

```typescript
import { startTimeline } from '@/lib/scheduling';

const scheduledTimeline = await startTimeline(photographerId, {
  template_id: template.id,
  trigger_type: 'booking_confirmed',
  trigger_context: {
    booking_id: 'booking-123',
    client_id: 'client-456'
  },
  start_date: '2026-09-10',  // YYYY-MM-DD
  timezone: 'America/New_York',
  context: {
    client_name: 'John & Jane Smith',
    session_date: 'September 15, 2026',
    location: 'Central Park, NYC',
    time: '3:00 PM',
    wedding_date: 'October 15, 2026',
    ceremony_time: '4:00 PM'
  },
});
```

This automatically:
1. Creates a `scheduled_timeline` record
2. Calculates dates for all milestones
3. Creates `scheduled_action` records for each milestone's actions
4. Sets status to `pending` (not yet due)

### 5. Monitor Scheduled Actions

```typescript
import { getScheduledActions, getTimelineEngineStats } from '@/lib/scheduling';

// Get all pending actions
const { actions, total } = await getScheduledActions({
  photographer_id: photographerId,
  status: ['pending'],
  is_queued: false,
  limit: 50,
});

// Get stats for dashboard
const stats = await getTimelineEngineStats(photographerId);
console.log(stats);
// {
//   total_templates: 3,
//   active_templates: 3,
//   total_timelines: 5,
//   active_timelines: 4,
//   completed_timelines: 1,
//   scheduled_actions_pending: 12,
//   scheduled_actions_prepared: 3,
//   scheduled_actions_due_today: 2,
//   scheduled_actions_overdue: 0
// }
```

### 6. Cron Job (Automatic)

The timeline engine runs an **hourly cron job** at `/api/cron/timeline-queue` that:

1. Finds all `scheduled_actions` with:
   - `status = 'pending'`
   - `is_queued = false`
   - `scheduled_at <= now`

2. For each due action:
   - Prepares (renders templates with context)
   - Queues to `action_queue` (Phase 3 routing)
   - Updates `scheduled_action` with `action_queue_id` reference

3. Returns detailed results

#### Setting Up Cron Job

In Vercel, add a cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/timeline-queue",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

Environment variable needed:
```
CRON_SECRET=your-secret-token
```

## Pre-Built Templates

The system includes three production-ready templates in `BUILT_IN_TEMPLATES`:

### 1. Wedding Timeline
- **Duration**: 60 days
- **Flow**:
  - Day 0: Engagement confirmation
  - Day 3: Engagement preview
  - Day 14: Wedding day details
  - Day 30: Engagement album
  - Day 60: Wedding album delivery

### 2. New Lead Nurture
- **Duration**: 30 days
- **Flow**:
  - Day 0: Welcome + portfolio
  - Day 3: Services & pricing
  - Day 7: Personal call
  - Day 14: Proposal follow-up
  - Day 30: Re-engagement final push

### 3. Post-Shoot Delivery
- **Duration**: 21 days
- **Flow**:
  - Day 0: Thank you
  - Day 7: Proofs ready
  - Day 14: Ordering options
  - Day 21: Final delivery

Import and customize:

```typescript
import { BUILT_IN_TEMPLATES } from '@/lib/scheduling';

// Get wedding template
const weddingTemplate = BUILT_IN_TEMPLATES['wedding-timeline'];

// Create from template
const template = await createTimelineTemplate(photographerId, {
  ...weddingTemplate,
  slug: 'my-wedding-workflow',
  name: 'My Wedding Workflow',
});

// Then add milestones and actions from weddingTemplate.milestones
for (const milestoneData of weddingTemplate.milestones) {
  const milestone = await addMilestone({
    template_id: template.id,
    ...milestoneData,
  });

  for (const actionData of milestoneData.actions) {
    await addAction({
      milestone_id: milestone.id,
      ...actionData,
    });
  }
}
```

## API Reference

### Template Management

#### `createTimelineTemplate(photographerId, request)`
Create a new reusable template.

**Parameters:**
- `photographerId`: UUID
- `request.slug`: Unique identifier (URL-safe)
- `request.name`: Display name
- `request.category`: `'photography_workflow' | 'client_journey' | 'campaign_cycle' | 'custom'`
- `request.duration_days`: Total timeline length
- `request.timezone`: Default timezone for calculations

**Returns:** `TimelineTemplate`

#### `getTimelineTemplate(templateId)`
Get a template by ID.

**Returns:** `TimelineTemplate`

#### `getPhotographerTemplates(photographerId, onlyActive?)`
Get all templates for a photographer.

**Returns:** `TimelineTemplate[]`

### Milestone Management

#### `addMilestone(request)`
Add a milestone to a template.

**Parameters:**
- `template_id`: UUID
- `position`: 0-based order
- `day_number`: Days from start (0, 3, 14, 30, etc.)
- `day_calc_mode`: `'calendar_days' | 'business_days' | 'relative_to_previous'`
- `repeat_every_days`: Optional (7 for weekly, 14 for bi-weekly, etc.)

**Returns:** `TimelineMilestone`

#### `getTemplateMilestones(templateId)`
Get all milestones for a template (ordered).

**Returns:** `TimelineMilestone[]`

### Action Management

#### `addAction(request)`
Add an action to a milestone.

**Parameters:**
- `milestone_id`: UUID
- `action_type`: From `action_type` enum (email, SMS, task, call, etc.)
- `priority_level`: `'red' | 'amber' | 'green'`
- `template_content`: Template text with `{{variable}}` placeholders
- `template_variables`: List of available variables
- `action_config`: Provider-specific config (email subject, SMS provider, etc.)

**Returns:** `MilestoneAction`

#### `getMilestoneActions(milestoneId)`
Get all actions for a milestone.

**Returns:** `MilestoneAction[]`

### Timeline Activation

#### `startTimeline(photographerId, request)`
Activate a template for a specific client/project.

**Parameters:**
- `template_id`: UUID
- `trigger_type`: `'booking_confirmed' | 'payment_received' | 'project_created' | 'manual' | 'api'`
- `trigger_context`: Metadata about what triggered this (booking_id, project_id, etc.)
- `start_date`: Optional YYYY-MM-DD (defaults to today)
- `context`: Template variables for rendering (client_name, location, etc.)

**Returns:** `ScheduledTimeline` (with all `scheduled_actions` created)

#### `calculateMilestoneDate(request)`
Calculate a specific milestone date.

**Parameters:**
- `start_date`: YYYY-MM-DD
- `day_number`: Days from start
- `day_calc_mode`: Calculation mode
- `timezone`: Timezone for calculation
- `preferred_time`: Optional HH:MM:SS

**Returns:** `CalculateMilestoneDateResponse` (date, time, timestamp)

### Action Queuing

#### `getScheduledActions(request)`
Get scheduled actions with filtering.

**Parameters:**
- `photographer_id`: UUID
- `status`: Optional array of statuses
- `is_queued`: Optional boolean
- `is_prepared`: Optional boolean
- `scheduled_before`: Optional ISO timestamp
- `scheduled_after`: Optional ISO timestamp
- `limit`: Optional (default 100)
- `offset`: Optional (default 0)

**Returns:** `GetScheduledActionsResponse` with actions and total count

#### `getDueActions(photographerId, limit?)`
Get actions due for execution (pending, not queued, scheduled_at <= now).

**Returns:** `ScheduledAction[]`

#### `prepareScheduledAction(scheduledActionId, context)`
Render templates with context variables.

**Parameters:**
- `context`: Record of template variables

**Returns:** `ScheduledAction` (with `prepared_content`)

#### `queueScheduledAction(scheduledActionId, photographerId)`
Queue to execution routing system.

**Returns:** Object with `scheduled_action` and `action_queue_id`

#### `executeScheduledAction(scheduledActionId, executionResult?)`
Mark action as executed.

**Returns:** `ScheduledAction` (with status = completed)

### Monitoring

#### `getTimelineEngineStats(photographerId)`
Get dashboard statistics.

**Returns:** `TimelineEngineStats`
```typescript
{
  total_templates: number,
  active_templates: number,
  total_timelines: number,
  active_timelines: number,
  completed_timelines: number,
  scheduled_actions_pending: number,
  scheduled_actions_prepared: number,
  scheduled_actions_due_today: number,
  scheduled_actions_overdue: number
}
```

#### `getTimelineMetrics(timelineId)`
Get progress metrics for a specific timeline.

**Returns:** `TimelineMetrics`
```typescript
{
  timeline_id: string,
  template_name: string,
  status: TimelineStatus,
  progress_percent: number,
  milestones_completed: number,
  milestones_total: number,
  actions_completed: number,
  actions_total: number,
  next_milestone_due?: string,
  last_action_executed?: string
}
```

## Integration with Phase 3 Execution Routing

When an action is queued, it creates an `action_queue` entry with:

```typescript
{
  photographer_id,
  action_type: 'auto_follow_up_email' | 'auto_schedule_reminder' | etc.
  execution_layer: 'lensello_automation',  // Default for timeline actions
  status: 'pending',
  priority_level: milestone_action.priority_level,
  title: milestone_action.title,
  description: milestone_action.description,
  context: prepared_content,
  metadata: {
    scheduled_action_id,
    milestone_title,
    timeline_context
  }
}
```

The Phase 3 routing system then:
1. Routes to appropriate layer (automation, AI, team, strategist)
2. Executes via integration layers (email provider, SMS, CRM, etc.)
3. Logs execution in `action_execution_log`
4. Updates `action_queue` status

## Database Indexes

Optimized for:

- **Finding due actions**: `scheduled_actions_due_idx` on `(scheduled_at)` WHERE status=pending
- **Timeline queries**: `scheduled_timelines_status_idx`, `scheduled_timelines_photographer_id_idx`
- **Action filtering**: `scheduled_actions_status_idx`, `scheduled_actions_is_queued_idx`

## Row-Level Security

All tables have RLS policies:

- **Users**: Can read/manage their own data
- **Service role**: Full access (for cron jobs and internal services)

## Timezone Handling

All timestamps stored in UTC. Calculations performed in photographer's timezone:

1. Template has `timezone` (photographer's local time)
2. Milestone can override with `timezone`
3. `calculateMilestoneDate()` returns ISO timestamp (UTC)
4. Cron job uses UTC comparisons

## Example: Complete Wedding Timeline Setup

```typescript
import {
  createTimelineTemplate,
  addMilestone,
  addAction,
  startTimeline,
} from '@/lib/scheduling';

async function setupWeddingTimeline(photographerId: string) {
  // 1. Create template
  const template = await createTimelineTemplate(photographerId, {
    slug: 'wedding-workflow',
    name: 'Wedding Photography Workflow',
    category: 'photography_workflow',
    duration_days: 60,
    timezone: 'America/New_York',
  });

  // 2. Add milestones
  const engagement = await addMilestone({
    template_id: template.id,
    position: 0,
    title: 'Engagement Session',
    day_number: 0,
    day_calc_mode: 'calendar_days',
    preferred_time: '09:00:00',
  });

  const wedding = await addMilestone({
    template_id: template.id,
    position: 1,
    title: 'Wedding Day',
    day_number: 14,
    day_calc_mode: 'calendar_days',
  });

  const delivery = await addMilestone({
    template_id: template.id,
    position: 2,
    title: 'Album Delivery',
    day_number: 60,
    day_calc_mode: 'calendar_days',
  });

  // 3. Add actions
  await addAction({
    milestone_id: engagement.id,
    action_type: 'auto_follow_up_email',
    priority_level: 'red',
    title: 'Engagement Details',
    template_content: 'Details for {{client_name}}...',
    template_variables: ['client_name'],
  });

  await addAction({
    milestone_id: delivery.id,
    action_type: 'auto_follow_up_email',
    priority_level: 'red',
    title: 'Album Ready',
    template_content: 'Your album is ready!',
    template_variables: [],
  });

  return template.id;
}

// 4. Start timeline when booking confirmed
async function onBookingConfirmed(bookingId: string, photographerId: string) {
  const timeline = await startTimeline(photographerId, {
    template_id: templateId,
    trigger_type: 'booking_confirmed',
    trigger_context: { booking_id: bookingId },
    context: {
      client_name: 'John & Jane Smith',
    },
  });

  console.log('Timeline started:', timeline.id);
}
```

## Troubleshooting

### Actions not queuing

1. Check cron job is running: `GET /api/cron/timeline-queue` with `CRON_SECRET`
2. Check `CRON_SECRET` is set in environment
3. Look for errors in logs
4. Verify `scheduled_at` is in the past

### Template variables not rendering

1. Verify `template_variables` array matches placeholders in `template_content`
2. Check `context` passed to `startTimeline()` has all required keys
3. Variable names must be exact match (case-sensitive)

### Incorrect dates

1. Verify `start_date` format (YYYY-MM-DD)
2. Check `day_calc_mode` (calendar vs business days)
3. Verify photographer's timezone setting
4. Test with `calculateMilestoneDate()` directly

## Performance Notes

- **Batch processing**: Cron job processes 50 actions per run (tunable)
- **Sequential execution**: Actions processed one-at-a-time to avoid rate limiting
- **Indexes**: Heavy use of indexes for date range queries
- **RLS**: Row-level security enabled but indexed queries are fast

## Future Enhancements

- Conditional milestones (skip based on booking type)
- Milestone repeating patterns (weekly reminders)
- Manual workflow triggers (photographer explicitly starts action)
- Template versioning
- A/B testing different email variations
- Analytics on action success rates
