# Timeline Engine Quick Reference

## File Structure

```
src/lib/scheduling/
├── types.ts                    # All TypeScript interfaces and pre-built templates
├── timeline-engine.ts          # Server actions (all the logic)
├── init-templates.ts           # Helper to load built-in templates
├── index.ts                    # Public exports
├── README.md                   # Full documentation
├── INTEGRATION_GUIDE.md         # Integration with UI and external systems
└── QUICK_REFERENCE.md          # This file

Database:
├── supabase/migrations/20260905200000_timeline_engine.sql  # Schema
```

## Core Exports

```typescript
import {
  // Template management
  createTimelineTemplate,
  getTimelineTemplate,
  getPhotographerTemplates,

  // Milestone management
  addMilestone,
  getTemplateMilestones,

  // Action management
  addAction,
  getMilestoneActions,

  // Timeline activation
  startTimeline,
  calculateMilestoneDate,

  // Action queuing
  getScheduledActions,
  getDueActions,
  prepareScheduledAction,
  queueScheduledAction,
  executeScheduledAction,

  // Monitoring
  getTimelineEngineStats,
  getTimelineMetrics,

  // Templates initialization
  initializeBuiltInTemplates,
  initializeTemplate,

  // Types
  TimelineTemplate,
  ScheduledTimeline,
  ScheduledAction,
  BUILT_IN_TEMPLATES,
} from '@/lib/scheduling';
```

## Key Types

### TimelineTemplate
```typescript
{
  id: string;
  photographer_id: string;
  slug: string;           // Unique identifier
  name: string;
  category: 'photography_workflow' | 'client_journey' | 'campaign_cycle' | 'custom';
  duration_days: number;
  timezone: string;
}
```

### TimelineMilestone
```typescript
{
  id: string;
  template_id: string;
  position: number;       // Order in timeline
  title: string;
  day_number: number;     // 0, 3, 14, 30, etc.
  day_calc_mode: 'calendar_days' | 'business_days' | 'relative_to_previous';
}
```

### MilestoneAction
```typescript
{
  id: string;
  milestone_id: string;
  action_type: ActionType;           // email, SMS, task, etc.
  priority_level: 'red' | 'amber' | 'green';
  title: string;
  template_content: string;          // {{variable}} placeholders
  template_variables: string[];      // Available vars for template
}
```

### ScheduledTimeline
```typescript
{
  id: string;
  photographer_id: string;
  template_id: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  trigger_type: TriggerType;         // booking_confirmed, manual, etc.
  trigger_context: Record<string, any>;
  context: Record<string, any>;      // Variables for template rendering
  start_date: string;                // YYYY-MM-DD
  started_at: string;                // ISO timestamp
}
```

### ScheduledAction
```typescript
{
  id: string;
  scheduled_timeline_id: string;
  milestone_id: string;
  scheduled_at: string;              // ISO timestamp
  scheduled_date: string;            // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  is_prepared: boolean;              // Template rendered?
  is_queued: boolean;                // Queued to action_queue?
  action_queue_id?: string;          // Reference to Phase 3
}
```

## Common Workflows

### 1. Create and Activate Template

```typescript
// Create
const template = await createTimelineTemplate(photographerId, {
  slug: 'wedding',
  name: 'Wedding Workflow',
  category: 'photography_workflow',
  duration_days: 60,
});

// Add milestone
const milestone = await addMilestone({
  template_id: template.id,
  position: 0,
  title: 'Day 0',
  day_number: 0,
});

// Add action
await addAction({
  milestone_id: milestone.id,
  action_type: 'auto_follow_up_email',
  title: 'Welcome Email',
  template_content: 'Hi {{client_name}}!',
  template_variables: ['client_name'],
});

// Activate
const scheduled = await startTimeline(photographerId, {
  template_id: template.id,
  trigger_type: 'manual',
  trigger_context: {},
  context: { client_name: 'John Smith' },
});
```

### 2. Monitor and Queue

```typescript
// Get stats
const stats = await getTimelineEngineStats(photographerId);
console.log(`${stats.scheduled_actions_due_today} actions due today`);

// Get due actions
const due = await getDueActions(photographerId);

// Manual queue
for (const action of due) {
  const { action_queue_id } = await queueScheduledAction(
    action.id,
    photographerId
  );
  console.log(`Queued ${action_queue_id}`);
}
```

### 3. Load Pre-Built Templates

```typescript
// Load all
await initializeBuiltInTemplates(photographerId);

// Or load one
await initializeTemplate(photographerId, 'wedding-timeline');
```

## Database Queries (Direct)

### Find Due Actions

```sql
SELECT * FROM public.scheduled_actions
WHERE
  photographer_id = 'photo-123'
  AND status = 'pending'
  AND is_queued = false
  AND scheduled_at <= now()
ORDER BY scheduled_at ASC
LIMIT 50;
```

### Timeline Progress

```sql
SELECT
  t.id,
  t.status,
  COUNT(a.id) as total_actions,
  SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_actions
FROM public.scheduled_timelines t
LEFT JOIN public.scheduled_actions a ON a.scheduled_timeline_id = t.id
WHERE t.photographer_id = 'photo-123' AND t.status = 'active'
GROUP BY t.id;
```

### Actions This Week

```sql
SELECT
  a.*,
  m.title as milestone_title,
  ma.title as action_title
FROM public.scheduled_actions a
JOIN public.timeline_milestones m ON a.milestone_id = m.id
JOIN public.milestone_actions ma ON a.milestone_action_id = ma.id
WHERE
  a.photographer_id = 'photo-123'
  AND a.scheduled_date >= CURRENT_DATE
  AND a.scheduled_date < CURRENT_DATE + INTERVAL '7 days'
ORDER BY a.scheduled_at;
```

## Cron Job Setup

### Vercel (Recommended)

**vercel.json:**
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

**Environment:**
```
CRON_SECRET=your-secret-here
```

### External Service

**Service**: EasyCron, AWS Lambda, Google Cloud Scheduler, etc.

**Request:**
```bash
GET https://your-app.vercel.app/api/cron/timeline-queue \
  -H "Authorization: Bearer your-secret-here"
```

## Pre-Built Templates

### Wedding Timeline
- Slug: `wedding-timeline`
- Duration: 60 days
- Milestones: Day 0, 3, 14, 30, 60

### New Lead Nurture
- Slug: `new-lead-nurture`
- Duration: 30 days
- Milestones: Day 0, 3, 7, 14, 30

### Post-Shoot Delivery
- Slug: `post-shoot-delivery`
- Duration: 21 days
- Milestones: Day 0, 7, 14, 21

## Template Variables Reference

### Available in All Timelines

These can be used in `template_content` and passed via `context`:

**Client Info:**
- `{{client_name}}`
- `{{client_email}}`
- `{{client_phone}}`

**Project Info:**
- `{{project_type}}`
- `{{booking_id}}`
- `{{session_date}}`
- `{{location}}`

**Dates:**
- `{{event_date}}`
- `{{wedding_date}}`
- `{{delivery_date}}`

**Photography Specific:**
- `{{studio_name}}`
- `{{photographer_name}}`
- `{{gallery_link}}`
- `{{proof_link}}`

### Custom Variables

Add any custom variable in `context` and use in templates:

```typescript
context: {
  client_name: 'John',
  custom_field: 'custom value',  // Available as {{custom_field}}
}
```

## Error Handling

### Try-Catch Pattern

```typescript
try {
  const timeline = await startTimeline(photographerId, {...});
  return { success: true, timeline_id: timeline.id };
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
    return { success: false, error: error.message };
  }
  throw error;
}
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Template not found" | Invalid template_id | Verify template exists |
| "Failed to create timeline" | DB constraint | Check photographer_id exists |
| "Failed to queue action" | Missing action_queue table | Run migration |
| "CRON_SECRET is not set" | Env var missing | Set CRON_SECRET |

## Performance Tips

1. **Batch Load**
   ```typescript
   // Good
   const timelines = await Promise.all(
     ids.map(id => getTimelineTemplate(id))
   );
   
   // Better - use direct SQL or pagination
   ```

2. **Limit Cron Batch**
   - Process 50 actions per run (tunable in route.ts)
   - Runs every hour = ~1200 actions/day max

3. **Use Indexes**
   - `scheduled_actions_due_idx` for finding due actions
   - `scheduled_timelines_status_idx` for active timelines

4. **Cache Dashboard Stats**
   - Use ISR to revalidate hourly
   - Store in `dashboard_state` table

## Debugging

### Check Due Actions

```typescript
const actions = await getDueActions(photographerId, 1000);
console.log(`Found ${actions.length} due actions`);
actions.forEach(a => {
  console.log(`${a.id}: ${a.scheduled_at} (${a.status})`);
});
```

### Verify Cron Is Running

```bash
# Check logs
curl https://vercel.com/docs/cron-jobs
# Look for timeline-queue calls

# Manual trigger (for testing)
curl https://your-app.vercel.app/api/cron/timeline-queue \
  -H "Authorization: Bearer YOUR_SECRET"
```

### Inspect Template Structure

```typescript
const template = await getTimelineTemplate(templateId);
const milestones = await getTemplateMilestones(templateId);

for (const milestone of milestones) {
  const actions = await getMilestoneActions(milestone.id);
  console.log(`${milestone.title}: ${actions.length} actions`);
}
```

## Next Steps

1. **Phase 2** (UI Layer) - Build dashboard, template editor, calendar view
2. **Phase 3** (Execution) - Route queued actions to email/SMS/task providers
3. **Integrations** - Connect booking system, payment, external CRM

## Support & Escalation

**Timeline Engine Support:**
- Bugs/Issues: File in project board
- New features: Request from Phase 2/3 agents
- Performance: Check indexes and batch sizes
- Cron problems: Verify CRON_SECRET and endpoint

**Related Systems:**
- Phase 2: Dashboard UI (Phase 2 agent)
- Phase 3: Execution routing (Phase 3 agent)
- Database: Supabase admin console
- Deployments: Vercel dashboard

---

**Last Updated:** 2026-09-05
**Version:** 1.0.0
**Status:** Production Ready
