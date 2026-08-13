import { Button } from '@/components/ui';
import { deleteLesson } from '../actions';

export function DeleteLessonForm({ lessonId, moduleSlug }: { lessonId: string; moduleSlug: string }) {
  return (
    <form action={deleteLesson} className="rounded-md border border-danger/30 bg-danger-subtle p-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="moduleSlug" value={moduleSlug} />
      <p className="text-sm font-medium text-danger">Delete this lesson</p>
      <p className="mt-1 text-xs text-danger">
        Deletes its resources, worksheets, and everyone&apos;s progress on it. This cannot be undone.
      </p>
      <Button type="submit" variant="danger" size="sm" className="mt-3">
        Delete lesson
      </Button>
    </form>
  );
}
