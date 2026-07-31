'use client';

import { useActionState } from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Select,
  Textarea,
} from '@/components/ui';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@lensello/core';
import { IDLE } from '@/lib/campaigns/action-state';
import { MAX_CAPTION_LENGTH } from '@/lib/campaigns/validation';
import { PLATFORM_LABELS } from '@/lib/campaigns/display';
import { addPost } from '../actions';

export function AddPostForm({
  campaignId,
  campaignPlatforms,
}: {
  campaignId: string;
  /** Offered first, since they are the platforms this campaign targets. */
  campaignPlatforms: SocialPlatform[];
}) {
  const [state, action, pending] = useActionState(addPost, IDLE);

  const preferred = campaignPlatforms.length > 0 ? campaignPlatforms : SOCIAL_PLATFORMS;
  const others = SOCIAL_PLATFORMS.filter(
    (platform) => !preferred.includes(platform),
  );

  return (
    <Card>
      <CardHeader
        title="Add a post"
        description="Write one yourself, or start it empty and rewrite the caption with AI once photos are attached."
      />
      <form action={action}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label="Platform" htmlFor="new-post-platform">
              <Select
                id="new-post-platform"
                name="platform"
                defaultValue={preferred[0]}
              >
                {preferred.map((platform) => (
                  <option key={platform} value={platform}>
                    {PLATFORM_LABELS[platform]}
                  </option>
                ))}
                {others.length > 0 ? (
                  <optgroup label="Not in this campaign">
                    {others.map((platform) => (
                      <option key={platform} value={platform}>
                        {PLATFORM_LABELS[platform]}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </Field>

            <Field label="Caption" htmlFor="new-post-caption">
              <Textarea
                id="new-post-caption"
                name="caption"
                rows={3}
                maxLength={MAX_CAPTION_LENGTH}
                placeholder="Optional — you can fill this in later."
              />
            </Field>
          </div>

          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            <Plus size={14} aria-hidden="true" />
            {pending ? 'Adding…' : 'Add post'}
          </Button>
        </CardBody>
      </form>
    </Card>
  );
}
