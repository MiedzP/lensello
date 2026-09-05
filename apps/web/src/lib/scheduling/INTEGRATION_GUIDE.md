# Timeline Engine Integration Guide

This guide covers how to integrate the Timeline Engine with Xerensys Lensello's UI, triggers, and external systems.

## Phase 2 & 3 Integration Points

### Phase 2: Dashboard & UI

The UI layer (Phase 2) consumes Timeline Engine data for:

1. **Timeline Management Dashboard**
   - List active timelines
   - Monitor progress (milestones completed, next due)
   - Pause/resume/cancel timelines
   - View scheduled actions calendar

2. **Template Library**
   - Browse pre-built templates
   - Customize template (add/edit/delete milestones)
   - Import/export templates
   - Clone and modify existing

3. **Scheduled Actions View**
   - Calendar view of all upcoming actions
   - Prepare actions manually (if not auto-prepared)
   - View prepared content before queuing
   - Manual execution override

### Phase 3: Execution Routing

The Timeline Engine feeds into Phase 3 via `scheduled_actions` → `action_queue`:

```
Cron: scheduled_actions (due) → prepareScheduledAction() → queueScheduledAction()
                                                              ↓
                                                        action_queue (pending)
                                                              ↓
                                                    routeAction(execution_layer)
                                                              ↓
                                        Phase 3 layer: automation/AI/team/strategist
```

## Integration Scenarios

### Scenario 1: New Booking → Auto Timeline

**Trigger**: Booking created

**Flow**:

```typescript
// In booking creation handler
import { startTimeline } from '@/lib/scheduling';

async function onBookingCreated(booking: Booking) {
  const photographer = booking.photographer_id;

  // Check if booking type has auto-trigger template
  const templates = await getPhotographerTemplates(photographer);
  const weddingTemplate = templates.find(
    (t) => t.category === 'photography_workflow' && t.name.includes('Wedding')
  );

  if (weddingTemplate && weddingTemplate.auto_trigger_on?.includes('booking_confirmed')) {
    // Start timeline
    await startTimeline(photographer, {
      template_id: weddingTemplate.id,
      trigger_type: 'booking_confirmed',
      trigger_context: {
        booking_id: booking.id,
        client_id: booking.client_id,
      },
      context: {
        client_name: booking.client_name,
        project_type: booking.project_type,
        session_date: booking.session_date,
        wedding_date: booking.event_date,
      },
    });

    console.log(`Timeline started for booking ${booking.id}`);
  }
}
```

### Scenario 2: Manual Photographer Action → Template Start

**Trigger**: Photographer manually starts timeline from UI

**Flow**:

```typescript
// In API handler
import { startTimeline, getTimelineTemplate } from '@/lib/scheduling';

export async function POST(request: Request) {
  const body = await request.json();
  const {
    photographerId,
    templateId,
    context,  // {client_name, project_type, etc}
  } = body;

  const timeline = await startTimeline(photographerId, {
    template_id: templateId,
    trigger_type: 'manual',
    trigger_context: { initiated_at: new Date().toISOString() },
    context,
  });

  return Response.json({ timeline_id: timeline.id });
}
```

### Scenario 3: Cron Job Queuing

**Trigger**: Hourly cron at `/api/cron/timeline-queue`

**Flow**:

```
1. GET /api/cron/timeline-queue?secret=CRON_SECRET
2. Find due actions (scheduled_at <= now, status=pending, is_queued=false)
3. For each action:
   - Fetch template context
   - Render template with variables
   - Create action_queue entry
   - Update scheduled_action with action_queue_id
4. Return results
```

**Vercel Cron Setup**:

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/timeline-queue",
      "schedule": "0 * * * *"
    }
  ]
}
```

Or use an external cron service and POST to the endpoint.

### Scenario 4: Manual Action Execution

**Trigger**: Photographer or admin manually queues an action

**Flow**:

```typescript
// In action override handler
import { prepareScheduledAction, queueScheduledAction } from '@/lib/scheduling';

export async function manualExecuteAction(actionId: string, photographerId: string) {
  // Get scheduled action context
  const { actions } = await getScheduledActions({
    photographer_id: photographerId,
  });
  const action = actions.find((a) => a.id === actionId);

  // Get timeline context
  const timeline = await getScheduledTimeline(action.scheduled_timeline_id);

  // Prepare with timeline context
  const prepared = await prepareScheduledAction(actionId, timeline.context);

  // Queue to execution
  const { action_queue_id } = await queueScheduledAction(actionId, photographerId);

  return { action_queue_id };
}
```

## Event-Driven Triggers

### Setting Up Auto-Triggers

**Database Entry**:

```sql
INSERT INTO public.action_triggers (
  photographer_id,
  template_id,
  trigger_type,
  trigger_table,
  auto_activate,
  requires_approval
) VALUES (
  'photo-123',
  'template-456',
  'booking_confirmed',
  'bookings',
  true,
  false
);
```

**Trigger Conditions** (optional):

```typescript
const trigger: ActionTrigger = {
  trigger_conditions: {
    booking_type: 'wedding',  // Only wedding bookings
    min_value_cents: 100000,  // Only bookings over $1000
  },
};
```

**Implementation in Event Handler**:

```typescript
async function onBookingCreated(booking: Booking) {
  const admin = createAdminClient();

  // Check if any triggers match
  const { data: triggers } = await admin
    .from('action_triggers')
    .select('*, template:timeline_templates(*)')
    .eq('photographer_id', booking.photographer_id)
    .eq('trigger_type', 'booking_confirmed');

  for (const trigger of triggers) {
    // Check conditions
    if (trigger.trigger_conditions) {
      if (trigger.trigger_conditions.booking_type && 
          booking.project_type !== trigger.trigger_conditions.booking_type) {
        continue;  // Skip this trigger
      }
      if (trigger.trigger_conditions.min_value_cents &&
          booking.value_cents < trigger.trigger_conditions.min_value_cents) {
        continue;  // Skip this trigger
      }
    }

    // Trigger matches, start timeline
    if (trigger.auto_activate) {
      await startTimeline(booking.photographer_id, {
        template_id: trigger.template_id,
        trigger_type: 'booking_confirmed',
        trigger_context: { booking_id: booking.id },
        context: { client_name: booking.client_name },
      });
    } else if (trigger.requires_approval) {
      // Create action_queue entry for photographer approval
      // Photographer sees notification to approve
    }
  }
}
```

## Dashboard Integration

### Timeline Calendar View

```typescript
// Component: src/app/(app)/timeline/calendar.tsx

import { getScheduledActions, getTimelineMetrics } from '@/lib/scheduling';

export async function TimelineCalendar({ photographerId }: Props) {
  // Get all scheduled actions for the month
  const { actions } = await getScheduledActions({
    photographer_id: photographerId,
    status: ['pending'],
    limit: 1000,
  });

  // Group by date
  const byDate = new Map<string, typeof actions>();
  for (const action of actions) {
    const date = action.scheduled_date;
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(action);
  }

  return (
    <Calendar>
      {Array.from(byDate.entries()).map(([date, dateActions]) => (
        <CalendarDay key={date} date={date}>
          {dateActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onPrepare={() => manualPrepare(action.id)}
              onExecute={() => manualExecute(action.id)}
            />
          ))}
        </CalendarDay>
      ))}
    </Calendar>
  );
}
```

### Timeline Progress Widget

```typescript
// Component showing progress for active timelines

import { getTimelineMetrics } from '@/lib/scheduling';

export async function TimelineProgress({ timelineId }: Props) {
  const metrics = await getTimelineMetrics(timelineId);

  return (
    <div className="timeline-progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${metrics.progress_percent}%` }}
        />
      </div>
      <div className="progress-text">
        {metrics.milestones_completed} of {metrics.milestones_total} milestones
      </div>
      {metrics.next_milestone_due && (
        <div className="next-milestone">
          Next: {metrics.next_milestone_due}
        </div>
      )}
    </div>
  );
}
```

### Dashboard Stats

```typescript
// src/components/dashboard-stats.tsx

import { getTimelineEngineStats } from '@/lib/scheduling';

export async function TimelineStats({ photographerId }: Props) {
  const stats = await getTimelineEngineStats(photographerId);

  return (
    <div className="stats-grid">
      <StatCard
        title="Active Timelines"
        value={stats.active_timelines}
        icon="📅"
      />
      <StatCard
        title="Due Today"
        value={stats.scheduled_actions_due_today}
        icon="⚡"
        className={stats.scheduled_actions_due_today > 0 ? 'highlight' : ''}
      />
      <StatCard
        title="Pending Actions"
        value={stats.scheduled_actions_pending}
        icon="📋"
      />
      <StatCard
        title="Overdue"
        value={stats.scheduled_actions_overdue}
        icon="⚠️"
        className={stats.scheduled_actions_overdue > 0 ? 'error' : ''}
      />
    </div>
  );
}
```

## Template Customization UI

### Edit Milestone

```typescript
// API: /api/milestones/[id]

import { addMilestone } from '@/lib/scheduling';

export async function PUT(request: Request, { params }: Props) {
  const body = await request.json();
  const { title, description, day_number, day_calc_mode } = body;

  // Delete old milestone
  const admin = createAdminClient();
  await admin
    .from('timeline_milestones')
    .delete()
    .eq('id', params.id);

  // Create new with same position
  const { data: oldMilestone } = await admin
    .from('timeline_milestones')
    .select('position, template_id')
    .eq('id', params.id)
    .single();

  const milestone = await addMilestone({
    template_id: oldMilestone.template_id,
    position: oldMilestone.position,
    title,
    description,
    day_number,
    day_calc_mode,
  });

  return Response.json(milestone);
}
```

## External Integration

### Zapier / Make.com

Connect external triggers:

```
External Event (e.g., Stripe Payment) 
  → Webhook to your API 
  → startTimeline()
```

**API Endpoint**:

```typescript
// POST /api/timelines/start-external

export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${process.env.API_KEY}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    photographer_id,
    template_id,
    trigger_type,
    trigger_context,
    context,
  } = body;

  const timeline = await startTimeline(photographer_id, {
    template_id,
    trigger_type: trigger_type || 'api',
    trigger_context,
    context,
  });

  return Response.json({ timeline_id: timeline.id });
}
```

**Zapier Action**:

```
Trigger: Payment received
Action: Webhook POST to /api/timelines/start-external
Body: {
  "photographer_id": "...",
  "template_id": "...",
  "trigger_context": {"payment_id": "{{payment_id}}"},
  "context": {"client_name": "{{customer.name}}"}
}
```

## Data Export

### Export Timeline as JSON

```typescript
export async function exportTimeline(timelineId: string) {
  const admin = createAdminClient();

  const { data: timeline } = await admin
    .from('scheduled_timelines')
    .select('*')
    .eq('id', timelineId)
    .single();

  const { data: actions } = await admin
    .from('scheduled_actions')
    .select('*')
    .eq('scheduled_timeline_id', timelineId);

  return {
    timeline,
    actions,
    exported_at: new Date().toISOString(),
  };
}
```

## Performance Optimization

### Batch Operations

```typescript
// Load multiple timelines efficiently
async function loadTimelines(timelineIds: string[]) {
  const admin = createAdminClient();

  const { data: timelines } = await admin
    .from('scheduled_timelines')
    .select('*, template:timeline_templates(*)')
    .in('id', timelineIds);

  // Preload all actions in one query
  const { data: actions } = await admin
    .from('scheduled_actions')
    .select('*')
    .in('scheduled_timeline_id', timelineIds);

  const actionsByTimeline = groupBy(actions, 'scheduled_timeline_id');

  return timelines.map((t) => ({
    ...t,
    actions: actionsByTimeline[t.id] || [],
  }));
}
```

### Caching

Use Next.js ISR for dashboard stats:

```typescript
// Revalidate every hour
export const revalidatePath = 3600;

export async function getTimelineStats(photographerId: string) {
  return await getTimelineEngineStats(photographerId);
}
```

## Testing

### Unit Test Template

```typescript
// lib/scheduling/__tests__/timeline-engine.test.ts

import { createTimelineTemplate, addMilestone, startTimeline } from '../timeline-engine';

describe('Timeline Engine', () => {
  it('should create a template', async () => {
    const template = await createTimelineTemplate('photo-123', {
      slug: 'test-workflow',
      name: 'Test Workflow',
      category: 'custom',
      duration_days: 7,
    });

    expect(template.id).toBeDefined();
    expect(template.name).toBe('Test Workflow');
  });

  it('should calculate milestone dates correctly', async () => {
    // Test calendar days
    let result = calculateMilestoneDate({
      start_date: '2026-09-10',
      day_number: 5,
      day_calc_mode: 'calendar_days',
      timezone: 'UTC',
    });
    expect(result.date).toBe('2026-09-15');

    // Test business days (skip weekend)
    result = calculateMilestoneDate({
      start_date: '2026-09-11',  // Friday
      day_number: 1,
      day_calc_mode: 'business_days',
      timezone: 'UTC',
    });
    expect(result.date).toBe('2026-09-14');  // Monday
  });

  it('should start a timeline and create scheduled actions', async () => {
    const template = await createTimelineTemplate('photo-123', {
      slug: 'test-workflow',
      name: 'Test',
      category: 'custom',
      duration_days: 7,
    });

    const milestone = await addMilestone({
      template_id: template.id,
      position: 0,
      title: 'Day 1',
      day_number: 1,
    });

    const timeline = await startTimeline('photo-123', {
      template_id: template.id,
      trigger_type: 'manual',
      trigger_context: {},
    });

    expect(timeline.status).toBe('active');
    expect(timeline.photographer_id).toBe('photo-123');
  });
});
```

## Migration & Cleanup

### Archive Old Timelines

```typescript
export async function archiveCompletedTimelines(photographerId: string) {
  const admin = createAdminClient();

  // Mark as completed if all actions done
  const { data: timelines } = await admin
    .from('scheduled_timelines')
    .select('id')
    .eq('photographer_id', photographerId)
    .eq('status', 'active');

  for (const timeline of timelines) {
    const { count: pending } = await admin
      .from('scheduled_actions')
      .select('*', { count: 'exact', head: true })
      .eq('scheduled_timeline_id', timeline.id)
      .eq('status', 'pending');

    if (pending === 0) {
      await admin
        .from('scheduled_timelines')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', timeline.id);
    }
  }
}
```

## Troubleshooting Checklist

- [ ] CRON_SECRET is set in environment
- [ ] Cron job running hourly (check logs at vercel.com)
- [ ] scheduled_at timestamps are in past (UTC)
- [ ] is_queued = false for pending actions
- [ ] action_queue entries created successfully
- [ ] Template variables match context keys
- [ ] Photographer timezone matches template timezone
- [ ] RLS policies not blocking reads/writes
