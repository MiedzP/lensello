'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Select, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import type { WorksheetAnswers, WorksheetField } from '@/lib/academy/types';
import { saveWorksheetDraft, submitWorksheetResponse } from '../worksheet-actions';

const AUTOSAVE_DELAY_MS = 1200;

function toInputValue(answer: WorksheetAnswers[string] | undefined): string {
  if (answer === undefined) return '';
  return Array.isArray(answer) ? answer.join('\n') : answer;
}

/**
 * A worksheet is just a form built from its `schema`. Answers autosave a
 * short pause after the last keystroke; only pressing Submit sets
 * `submitted_at` and rolls the answers up into `business_profile` (via
 * `submitWorksheetResponse` -> `buildProfilePatch`) — typing does not.
 */
export function WorksheetForm({
  lessonId,
  worksheetSlug,
  fields,
  initialAnswers,
  submittedAt,
}: {
  lessonId: string;
  worksheetSlug: string;
  fields: WorksheetField[];
  initialAnswers: WorksheetAnswers;
  submittedAt: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const fieldDef of fields) initial[fieldDef.key] = toInputValue(initialAnswers[fieldDef.key]);
    return initial;
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(submittedAt);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildFormData = useCallback(
    (current: Record<string, string>) => {
      const formData = new FormData();
      formData.set('lessonId', lessonId);
      formData.set('worksheetSlug', worksheetSlug);
      for (const [key, value] of Object.entries(current)) formData.set(key, value);
      return formData;
    },
    [lessonId, worksheetSlug],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(key: string, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    setStatus('saving');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void saveWorksheetDraft(IDLE, buildFormData(next)).then((result) => {
        setStatus(result.ok ? 'saved' : 'error');
        setMessage(result.message);
      });
    }, AUTOSAVE_DELAY_MS);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('saving');
    const result = await submitWorksheetResponse(IDLE, buildFormData(values));
    setStatus(result.ok ? 'saved' : 'error');
    setMessage(result.message);
    if (result.ok) setSubmitted(new Date().toISOString());
  }

  return (
    <Card>
      <CardHeader
        title="Your answers"
        description={
          submitted
            ? 'Submitted. You can keep editing — submitting again updates the business profile.'
            : 'Draft — nothing here counts until you submit.'
        }
      />
      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-4">
          {fields.map((fieldDef) => (
            <Field key={fieldDef.key} label={fieldDef.label} htmlFor={fieldDef.key} hint={fieldDef.help}>
              {fieldDef.type === 'textarea' || fieldDef.type === 'list' ? (
                <Textarea
                  id={fieldDef.key}
                  name={fieldDef.key}
                  rows={fieldDef.type === 'list' ? 4 : 3}
                  value={values[fieldDef.key] ?? ''}
                  placeholder={fieldDef.type === 'list' ? 'One per line' : undefined}
                  onChange={(event) => handleChange(fieldDef.key, event.target.value)}
                />
              ) : fieldDef.type === 'select' ? (
                <Select
                  id={fieldDef.key}
                  name={fieldDef.key}
                  value={values[fieldDef.key] ?? ''}
                  onChange={(event) => handleChange(fieldDef.key, event.target.value)}
                >
                  <option value="">Choose…</option>
                  {(fieldDef.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={fieldDef.key}
                  name={fieldDef.key}
                  value={values[fieldDef.key] ?? ''}
                  onChange={(event) => handleChange(fieldDef.key, event.target.value)}
                />
              )}
            </Field>
          ))}
        </CardBody>

        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-xs text-muted" aria-live="polite">
            {status === 'saving'
              ? 'Saving…'
              : status === 'error'
                ? message
                : status === 'saved'
                  ? message
                  : submitted
                    ? `Last submitted ${new Date(submitted).toLocaleDateString()}.`
                    : 'Not yet submitted.'}
          </p>
          <Button type="submit" variant="primary">
            {submitted ? 'Update submission' : 'Submit'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
