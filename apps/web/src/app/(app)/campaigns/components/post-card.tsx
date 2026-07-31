'use client';

import Image from 'next/image';
import { useActionState, useOptimistic, useState, useTransition } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Send,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  ErrorNote,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import type { PostStatus, SocialPlatform } from '@lensello/core';
import { IDLE } from '@/lib/campaigns/action-state';
import type { Photo } from '@/lib/campaigns/queries';
import {
  ALLOWED_POST_TRANSITIONS,
  MAX_ASSETS_PER_POST,
  MAX_CAPTION_LENGTH,
  PUBLISHABLE_STATUSES,
} from '@/lib/campaigns/validation';
import {
  POST_STATUS_LABELS,
  POST_STATUS_TONES,
  PLATFORM_LABELS,
  formatHashtags,
  formatTimestamp,
  toDateTimeLocalValue,
} from '@/lib/campaigns/display';
import {
  changePostStatus,
  deletePost,
  publishPost,
  regenerateCaption,
  setPostAssets,
  updatePostContent,
} from '../actions';
import { PhotoPicker } from './photo-picker';

export interface PostView {
  id: string;
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  assetIds: string[];
  status: PostStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  externalId: string | null;
  failureReason: string | null;
}

export function PostCard({
  post,
  photos,
  aiConfigured,
}: {
  post: PostView;
  /** Ordered; index 0 is the carousel cover. */
  photos: Photo[];
  aiConfigured: boolean;
}) {
  const isPublished = post.status === 'published';
  const transitions = ALLOWED_POST_TRANSITIONS[post.status];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {PLATFORM_LABELS[post.platform]}
          </h3>
          <Badge tone={POST_STATUS_TONES[post.status]}>
            {POST_STATUS_LABELS[post.status]}
          </Badge>
        </div>

        <p className="text-xs text-muted">
          {post.status === 'published' && post.publishedAt
            ? `Published ${formatTimestamp(post.publishedAt)}`
            : post.scheduledFor
              ? `${post.status === 'scheduled' ? 'Goes out' : 'Planned for'} ${formatTimestamp(post.scheduledFor)}`
              : 'Not scheduled'}
          {post.externalId ? ` · ${post.externalId}` : ''}
        </p>
      </div>

      <CardBody className="space-y-4">
        {post.status === 'failed' && post.failureReason ? (
          <ErrorNote>
            <span className="font-medium">Publishing failed.</span>{' '}
            {post.failureReason}
          </ErrorNote>
        ) : null}

        <PostPhotos
          postId={post.id}
          photos={photos}
          disabled={isPublished}
        />

        {/* Remounts when the stored caption changes — a regenerated caption has
            to replace what is on screen, and an uncontrolled textarea would
            otherwise keep showing the old text. */}
        <PostEditor
          key={`${post.id}:${post.caption}:${post.hashtags.join(',')}`}
          post={post}
          aiConfigured={aiConfigured}
          disabled={isPublished}
        />
      </CardBody>

      <CardFooter className="flex-wrap justify-between gap-3">
        <StatusControls post={post} transitions={transitions} />
        <div className="flex flex-wrap items-center gap-2">
          <PublishControl post={post} />
          <DeleteControl postId={post.id} platform={post.platform} />
        </div>
      </CardFooter>
    </Card>
  );
}

// --- caption + hashtags -------------------------------------------------

function PostEditor({
  post,
  aiConfigured,
  disabled,
}: {
  post: PostView;
  aiConfigured: boolean;
  disabled: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(updatePostContent, IDLE);
  const [aiState, aiAction, regenerating] = useActionState(
    regenerateCaption,
    IDLE,
  );
  const [caption, setCaption] = useState(post.caption);

  return (
    <div className="space-y-3">
      {saveState.error ? <ErrorNote>{saveState.error}</ErrorNote> : null}
      {aiState.error ? <ErrorNote>{aiState.error}</ErrorNote> : null}
      {saveState.message || aiState.message ? (
        <p role="status" className="text-sm text-success">
          {saveState.message ?? aiState.message}
        </p>
      ) : null}

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="postId" value={post.id} />

        <Field
          label="Caption"
          htmlFor={`caption-${post.id}`}
          hint={`${caption.length} / ${MAX_CAPTION_LENGTH} characters`}
        >
          <Textarea
            id={`caption-${post.id}`}
            name="caption"
            rows={6}
            maxLength={MAX_CAPTION_LENGTH}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            disabled={disabled}
          />
        </Field>

        <Field
          label="Hashtags"
          htmlFor={`hashtags-${post.id}`}
          hint="Space-separated. The # is optional and gets cleaned up on save."
        >
          <Input
            id={`hashtags-${post.id}`}
            name="hashtags"
            defaultValue={formatHashtags(post.hashtags)}
            disabled={disabled}
          />
        </Field>

        {disabled ? (
          <p className="text-xs text-muted">
            This post is live on the platform, so its copy is locked here —
            editing it would not change what people see.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save copy'}
            </Button>
          </div>
        )}
      </form>

      {!disabled ? (
        <form action={aiAction}>
          <input type="hidden" name="postId" value={post.id} />
          <Button
            type="submit"
            size="sm"
            disabled={regenerating || !aiConfigured}
            title={
              aiConfigured
                ? 'Rewrite this caption from the attached photos'
                : 'Set ANTHROPIC_API_KEY on the server to enable AI rewriting'
            }
          >
            {regenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Rewriting…
              </>
            ) : (
              <>
                <Sparkles size={14} aria-hidden="true" />
                Rewrite caption
              </>
            )}
          </Button>
          {!aiConfigured ? (
            <span className="ml-2 text-xs text-muted">
              AI rewriting needs <code className="text-xs">ANTHROPIC_API_KEY</code>{' '}
              on the server.
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

// --- attached photos ----------------------------------------------------

function PostPhotos({
  postId,
  photos,
  disabled,
}: {
  postId: string;
  photos: Photo[];
  disabled: boolean;
}) {
  // Optimistic so reordering feels immediate; the server's array wins once the
  // transition settles.
  const [shown, setShown] = useOptimistic<Photo[], Photo[]>(
    photos,
    (_current, next) => next,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save(next: Photo[]) {
    startSaving(async () => {
      setShown(next);
      const result = await setPostAssets(
        postId,
        next.map((photo) => photo.assetId),
      );
      setError(result.error);
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= shown.length) return;
    const next = [...shown];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    save(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Photos
          <span className="ml-2 text-xs font-normal text-muted">
            {shown.length === 0
              ? 'None attached'
              : `${shown.length} of ${MAX_ASSETS_PER_POST} · first is the cover`}
          </span>
        </p>
        {saving ? (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            Saving
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-3">
          {shown.map((photo, index) => (
            <li key={photo.assetId} className="w-24">
              <div className="relative size-24 overflow-hidden rounded-md border border-subtle">
                {photo.url ? (
                  <Image
                    src={photo.url}
                    alt={photo.altText ?? photo.filename}
                    width={192}
                    height={192}
                    quality={50}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center bg-surface-raised px-1 text-center text-[10px] text-faint">
                    Preview unavailable
                  </span>
                )}
                {index === 0 ? (
                  <span className="absolute inset-x-0 top-0 bg-accent/90 py-0.5 text-center text-[10px] font-medium text-accent-foreground">
                    Cover
                  </span>
                ) : null}
              </div>

              {!disabled ? (
                <div className="mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={saving || index === 0}
                    aria-label={`Move ${photo.filename} earlier`}
                    className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowLeft size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 0)}
                    disabled={saving || index === 0}
                    aria-label={`Make ${photo.filename} the cover`}
                    className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                  >
                    <Star size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={saving || index === shown.length - 1}
                    aria-label={`Move ${photo.filename} later`}
                    className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      save(shown.filter((item) => item.assetId !== photo.assetId))
                    }
                    disabled={saving}
                    aria-label={`Remove ${photo.filename}`}
                    className="rounded p-1 text-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:opacity-30"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-md border border-dashed border-strong px-4 py-4 text-sm text-muted">
          No photos attached. Every platform we publish to needs at least one
          image.
        </p>
      )}

      {!disabled ? (
        <div className="mt-3">
          <PhotoPicker
            attachedIds={shown.map((photo) => photo.assetId)}
            remaining={MAX_ASSETS_PER_POST - shown.length}
            onPick={(photo) => save([...shown, photo])}
          />
        </div>
      ) : null}
    </div>
  );
}

// --- status -------------------------------------------------------------

function StatusControls({
  post,
  transitions,
}: {
  post: PostView;
  transitions: readonly PostStatus[];
}) {
  const [state, action, pending] = useActionState(changePostStatus, IDLE);
  const offersScheduling = transitions.includes('scheduled');

  if (transitions.length === 0) {
    return (
      <p className="text-xs text-muted">
        Published posts are final here. Delete this card if you have taken the
        post down on the platform.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="postId" value={post.id} />

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        {offersScheduling ? (
          <label className="text-xs text-muted">
            <span className="mb-1 block">Send at</span>
            <Input
              type="datetime-local"
              name="scheduledFor"
              defaultValue={toDateTimeLocalValue(post.scheduledFor)}
              className="h-8 w-auto text-xs"
            />
          </label>
        ) : null}

        {transitions.map((next) => (
          <Button
            key={next}
            type="submit"
            name="status"
            value={next}
            size="sm"
            variant={next === 'approved' ? 'primary' : 'secondary'}
            disabled={pending}
          >
            {LABELS[next]}
          </Button>
        ))}
      </div>
    </form>
  );
}

const LABELS: Record<PostStatus, string> = {
  draft: 'Back to draft',
  approved: 'Approve',
  scheduled: 'Schedule',
  published: 'Published',
  failed: 'Failed',
};

// --- publish + delete ---------------------------------------------------

function PublishControl({ post }: { post: PostView }) {
  const [state, action, pending] = useActionState(publishPost, IDLE);

  if (!PUBLISHABLE_STATUSES.includes(post.status)) {
    return state.error ? (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    ) : null;
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="postId" value={post.id} />
      {state.error ? (
        <p role="alert" className="max-w-sm text-right text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Publishing…
          </>
        ) : (
          <>
            <Send size={14} aria-hidden="true" />
            {post.status === 'failed' ? 'Retry publish' : 'Publish now'}
          </>
        )}
      </Button>
    </form>
  );
}

function DeleteControl({
  postId,
  platform,
}: {
  postId: string;
  platform: SocialPlatform;
}) {
  const [state, action, pending] = useActionState(deletePost, IDLE);

  return (
    <form action={action}>
      <input type="hidden" name="postId" value={postId} />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={(event) => {
          if (
            !window.confirm(
              `Delete this ${PLATFORM_LABELS[platform]} post? This cannot be undone.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        {pending ? 'Deleting…' : 'Delete'}
      </Button>
    </form>
  );
}
