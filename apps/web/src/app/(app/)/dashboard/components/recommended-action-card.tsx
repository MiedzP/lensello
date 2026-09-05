'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, Button, Badge } from '@/components/ui';
import { ArrowRight, Loader2 } from 'lucide-react';
import { executeAction } from '../actions';

/**
 * Recommended Action Card
 *
 * Shows the top recommended action with a 1-click execute button.
 * Example: "You have 23 past enquiries who haven't booked. Create nurture campaign →"
 */
export function RecommendedActionCard() {
  const [isPending, startTransition] = useTransition();
  const [isExecuted, setIsExecuted] = useState(false);

  // Mock recommended action (will come from dashboard_state)
  const recommendedAction = {
    title: 'Create nurture campaign for warm enquiries',
    description: 'You have 23 past enquiries who haven\'t booked.',
    impact: 'Could convert 5+ warm enquiries into bookings',
    estimated_time_minutes: 15,
    execution_layer: 'team_execution' as const,
  };

  const handleExecute = async () => {
    startTransition(async () => {
      try {
        const result = await executeAction({
          title: recommendedAction.title,
          action_type: 'team_setup_campaign',
          execution_layer: recommendedAction.execution_layer,
          description: recommendedAction.description,
          priority_level: 'red',
        });

        if (result.success) {
          setIsExecuted(true);
          // Toast/notification would go here
          setTimeout(() => setIsExecuted(false), 3000);
        }
      } catch (error) {
        console.error('Failed to execute action:', error);
      }
    });
  };

  return (
    <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
      <CardBody className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-muted">{recommendedAction.description}</p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {recommendedAction.title}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">
              {recommendedAction.estimated_time_minutes}m
            </Badge>
            <span className="text-xs text-muted">
              {recommendedAction.impact}
            </span>
          </div>
        </div>

        <Button
          onClick={handleExecute}
          disabled={isPending || isExecuted}
          className="shrink-0"
          tone={isExecuted ? 'success' : 'primary'}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-1">Creating...</span>
            </>
          ) : isExecuted ? (
            <>
              <span>✓ Created</span>
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              <span className="ml-1">Execute</span>
            </>
          )}
        </Button>
      </CardBody>
    </Card>
  );
}
