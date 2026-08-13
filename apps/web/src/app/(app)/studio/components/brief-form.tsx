'use client';

import { useActionState, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ErrorNote, Field, Select, Textarea } from '@/components/ui';
import type { ShootOption } from '@/lib/studio/queries';
import { submitBrief } from '../actions';
import { IDLE } from '../action-state';

const EXAMPLES = [
  "I want to create a post about the groom's speech",
  '10 photos of confetti for the summer campaign',
  'Something showing the venue at golden hour',
];

/**
 * The brief box — the heart of the module.
 *
 * A textarea and one dropdown. Everything else (interpreting the words,
 * searching the library, ranking what comes back) happens after submit, on
 * the server, and lands the photographer on the shortlist for this exact
 * brief.
 */
export function BriefForm({ shootOptions }: { shootOptions: ShootOption[] }) {
  const [state, action, pending] = useActionState(submitBrief, IDLE);
  const [prompt, setPrompt] = useState('');

  return (
    <Card>
      <CardHeader
        title="Describe what you want"
        description={`For example: "${EXAMPLES[0]}"`}
      />
      <CardBody className="space-y-4">
        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <form action={action} className="space-y-4">
          <Field label="Brief" htmlFor="studio-prompt">
            <Textarea
              id="studio-prompt"
              name="prompt"
              rows={3}
              placeholder={EXAMPLES[0]}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2000}
            />
          </Field>

          <Field
            label="Shoot"
            htmlFor="studio-shoot"
            hint="Narrow the search to one shoot, or search everything captioned so far."
          >
            <Select id="studio-shoot" name="shootId" defaultValue="">
              <option value="">Search the whole library</option>
              {shootOptions.map((shoot) => (
                <option key={shoot.id} value={shoot.id}>
                  {shoot.title}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" variant="primary" disabled={pending || prompt.trim().length < 3}>
            <Sparkles size={14} aria-hidden="true" />
            {pending ? 'Searching…' : 'Find photos'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
