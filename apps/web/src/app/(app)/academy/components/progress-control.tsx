import { CheckCircle2, Circle } from 'lucide-react';
import { setLessonProgress } from '../actions';

export function ProgressControl({
  lessonId,
  status,
}: {
  lessonId: string;
  status: 'in_progress' | 'complete' | null;
}) {
  if (status === 'complete') {
    return (
      <form action={setLessonProgress}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="status" value="in_progress" />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md border border-strong bg-surface px-3 py-1.5 text-xs font-medium text-success hover:bg-surface-hover"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          Complete — mark as not finished
        </button>
      </form>
    );
  }

  return (
    <form action={setLessonProgress}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="status" value="complete" />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent-hover"
      >
        <Circle size={14} aria-hidden="true" />
        Mark this lesson complete
      </button>
    </form>
  );
}
