import { Button } from '@/components/ui';

/**
 * A one-button publish/unpublish toggle. Plain form action, no client JS
 * required — matches the checklist toggle pattern in `lib/gigs`.
 */
export function PublishForm({
  action,
  hiddenName,
  hiddenValue,
  isPublished,
}: {
  action: (formData: FormData) => Promise<void>;
  hiddenName: string;
  hiddenValue: string;
  isPublished: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name={hiddenName} value={hiddenValue} />
      <input type="hidden" name="published" value={isPublished ? '0' : '1'} />
      <Button type="submit" size="sm" variant={isPublished ? 'secondary' : 'primary'}>
        {isPublished ? 'Unpublish' : 'Publish'}
      </Button>
    </form>
  );
}
