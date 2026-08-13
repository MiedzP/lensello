import Link from 'next/link';
import { ChevronDown, ChevronRight, ChevronUp, Clock } from 'lucide-react';
import type { LessonWithProgress } from '@/lib/academy/queries';
import { moveLesson } from '../actions';
import { ProgressBadge, PublishBadge } from './badges';

export function LessonRow({
  moduleSlug,
  moduleId,
  lesson,
  isFirst,
  isLast,
}: {
  moduleSlug: string;
  moduleId: string;
  lesson: LessonWithProgress;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-subtle bg-surface px-3 py-2.5">
      <div className="flex shrink-0 flex-col">
        <form action={moveLesson}>
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="direction" value="up" />
          <button
            type="submit"
            disabled={isFirst}
            aria-label="Move lesson up"
            className="flex size-5 items-center justify-center text-faint disabled:opacity-30 hover:text-foreground"
          >
            <ChevronUp size={14} />
          </button>
        </form>
        <form action={moveLesson}>
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="direction" value="down" />
          <button
            type="submit"
            disabled={isLast}
            aria-label="Move lesson down"
            className="flex size-5 items-center justify-center text-faint disabled:opacity-30 hover:text-foreground"
          >
            <ChevronDown size={14} />
          </button>
        </form>
      </div>

      <Link href={`/academy/${moduleSlug}/${lesson.slug}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{lesson.title}</p>
        {lesson.summary ? <p className="truncate text-xs text-muted">{lesson.summary}</p> : null}
      </Link>

      {lesson.estimated_minutes ? (
        <span className="hidden shrink-0 items-center gap-1 text-xs text-faint sm:flex">
          <Clock size={12} aria-hidden="true" />
          {lesson.estimated_minutes} min
        </span>
      ) : null}

      <PublishBadge isPublished={lesson.is_published} />
      <ProgressBadge status={lesson.progress?.status ?? null} />

      <Link
        href={`/academy/${moduleSlug}/${lesson.slug}/edit`}
        className="shrink-0 text-xs font-medium text-accent hover:underline"
      >
        Edit
      </Link>

      <Link href={`/academy/${moduleSlug}/${lesson.slug}`} aria-hidden="true" className="text-faint">
        <ChevronRight size={16} />
      </Link>
    </li>
  );
}
