'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { renderLessonMarkdown } from '@/lib/academy/markdown';
import { updateLessonBody } from '../actions';
import { LessonContent } from './prose';

/**
 * Markdown in, preview alongside. The preview runs the exact same
 * `renderLessonMarkdown` the reading page uses on the server — what the
 * studio sees while writing is what a client actually gets, not an
 * approximation from a different renderer.
 *
 * Autosaves on a pause in typing; a manual "Save now" is also available in
 * case someone wants to be sure before navigating away.
 */
export function LessonEditor({ lessonId, initialBody }: { lessonId: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const html = useMemo(() => renderLessonMarkdown(body), [body]);

  async function save(nextBody: string) {
    setStatus('saving');
    const formData = new FormData();
    formData.set('lessonId', lessonId);
    formData.set('bodyMd', nextBody);
    const result = await updateLessonBody(IDLE, formData);
    setStatus(result.ok ? 'saved' : 'error');
    setMessage(result.message);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Markdown"
            description="Headings (#), **bold**, *italic*, lists, > quotes, [links](https://…), and ``` code fences."
          />
          <CardBody>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => {
                if (body !== initialBody) void save(body);
              }}
              rows={26}
              className="font-mono text-sm"
              aria-label="Lesson body, in Markdown"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preview" description="What the studio's team sees on the lesson page." />
          <CardBody>
            {body.trim() === '' ? (
              <p className="text-sm text-muted">Nothing written yet.</p>
            ) : (
              <LessonContent html={html} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save(body)}
          disabled={status === 'saving'}
          className="rounded-md border border-strong bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-60"
        >
          {status === 'saving' ? 'Saving…' : 'Save now'}
        </button>
        <p className="text-xs text-muted" aria-live="polite">
          {status === 'saved'
            ? 'Saved.'
            : status === 'error'
              ? message
              : 'Saves automatically when you click away from the editor.'}
        </p>
      </div>
    </div>
  );
}
