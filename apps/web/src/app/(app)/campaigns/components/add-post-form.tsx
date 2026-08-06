'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
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
import { linkNote, type PlatformLinks } from '@/lib/connections/links';
import { addPost } from '../actions';

export function AddPostForm({
  campaignId,
  campaignPlatforms,
  links,
}: {
  campaignId: string;
  /** Offered first, since they are the platforms this campaign targets. */
  campaignPlatforms: SocialPlatform[];
  links: PlatformLinks;
}) {
  const [state, action, pending] = useActionState(addPost, IDLE);

  const preferred = campaignPlatforms.length > 0 ? campaignPlatforms : SOCIAL_PLATFORMS;
  const others = SOCIAL_PLATFORMS.filter(
    (platform) => !preferred.includes(platform),
  );

  // Tracked so the warning follows the selection. A post for an unlinked
  // platform is still worth drafting — it just cannot ship until the account
  // is linked, and saying so here beats discovering it at publish time.
  const [selected, setSelected] = useState<SocialPlatform>(
    preferred[0] ?? SOCIAL_PLATFORMS[0],
  );
  const selectedLink = links[selected];

  const label = (platform: SocialPlatform) =>
    `${PLATFORM_LABELS[platform]} — ${linkNote(links[platform])}`;

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
            <Field
              label="Platform"
              htmlFor="new-post-platform"
              hint={
                selectedLink.canPublish ? undefined : (
                  <span className="text-warning">
                    {PLATFORM_LABELS[selected]} is {linkNote(selectedLink)}.{' '}
                    <Link href="/connections" className="text-accent hover:underline">
                      Link it
                    </Link>{' '}
                    before publishing.
                  </span>
                )
              }
            >
              <Select
                id="new-post-platform"
                name="platform"
                value={selected}
                onChange={(event) =>
                  setSelected(event.target.value as SocialPlatform)
                }
              >
                {preferred.map((platform) => (
                  <option key={platform} value={platform}>
                    {label(platform)}
                  </option>
                ))}
                {others.length > 0 ? (
                  <optgroup label="Not in this campaign">
                    {others.map((platform) => (
                      <option key={platform} value={platform}>
                        {label(platform)}
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
