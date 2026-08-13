'use client';

import { useActionState, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ErrorNote, Input, Textarea } from '@/components/ui';
import { createSection, deleteSection, moveSection, toggleSectionAsset, updateSection } from '../actions';
import { GALLERY_ADMIN_IDLE } from '../admin-state';

export interface SectionView {
  id: string;
  title: string;
  blurb: string | null;
  assetIds: string[];
}

export interface AssetOption {
  id: string;
  filename: string;
}

/**
 * "Ceremony", "Speeches", "Portraits" — the chapters `fine_art` and `story`
 * render. `mosaic`, `film_strip` and `contact_sheet` ignore this entirely, so
 * a gallery in one of those styles works exactly the same with no sections at
 * all.
 */
export function SectionsPanel({
  galleryId,
  sections,
  assets,
}: {
  galleryId: string;
  sections: SectionView[];
  assets: AssetOption[];
}) {
  return (
    <Card>
      <CardHeader
        title="Sections"
        description="Group photographs into chapters — used by the fine art and story styles, ignored by the rest."
      />
      <CardBody className="space-y-5">
        <NewSectionForm galleryId={galleryId} />

        {sections.length === 0 ? (
          <p className="text-sm text-muted">
            No sections yet. The gallery shows as one continuous set until you add some.
          </p>
        ) : (
          <ul className="space-y-3">
            {sections.map((section, index) => (
              <SectionRow
                key={section.id}
                galleryId={galleryId}
                section={section}
                assets={assets}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function NewSectionForm({ galleryId }: { galleryId: string }) {
  const [state, action, pending] = useActionState(createSection, GALLERY_ADMIN_IDLE);

  return (
    <form action={action} className="space-y-3 rounded-md border border-subtle p-4">
      <input type="hidden" name="galleryId" value={galleryId} />
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="title" placeholder="Section name, e.g. Ceremony" required />
        <Input name="blurb" placeholder="Blurb shown above it (optional)" />
      </div>
      <Button type="submit" disabled={pending}>
        <Plus size={14} aria-hidden="true" />
        {pending ? 'Adding…' : 'Add section'}
      </Button>
    </form>
  );
}

function SectionRow({
  galleryId,
  section,
  assets,
  isFirst,
  isLast,
}: {
  galleryId: string;
  section: SectionView;
  assets: AssetOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [updateState, updateAction, updating] = useActionState(updateSection, GALLERY_ADMIN_IDLE);
  const [deleteState, deleteAction] = useActionState(deleteSection, GALLERY_ADMIN_IDLE);
  const [, moveAction] = useActionState(moveSection, GALLERY_ADMIN_IDLE);

  const memberIds = new Set(section.assetIds);

  return (
    <li className="rounded-md border border-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form action={updateAction} className="space-y-2">
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="galleryId" value={galleryId} />
              {updateState.error ? <ErrorNote>{updateState.error}</ErrorNote> : null}
              <Input name="title" defaultValue={section.title} required />
              <Textarea name="blurb" defaultValue={section.blurb ?? ''} rows={2} placeholder="Blurb (optional)" />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={updating}>
                  {updating ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">{section.title}</p>
              {section.blurb ? <p className="mt-0.5 text-xs text-muted">{section.blurb}</p> : null}
              <p className="mt-1 text-xs text-faint">
                {section.assetIds.length} photograph{section.assetIds.length === 1 ? '' : 's'}
              </p>
            </>
          )}
        </div>

        {editing ? null : (
          <div className="flex shrink-0 items-center gap-1">
            <form action={moveAction}>
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="galleryId" value={galleryId} />
              <input type="hidden" name="direction" value="up" />
              <Button type="submit" size="sm" disabled={isFirst} aria-label="Move section up">
                <ChevronUp size={14} aria-hidden="true" />
              </Button>
            </form>
            <form action={moveAction}>
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="galleryId" value={galleryId} />
              <input type="hidden" name="direction" value="down" />
              <Button type="submit" size="sm" disabled={isLast} aria-label="Move section down">
                <ChevronDown size={14} aria-hidden="true" />
              </Button>
            </form>
            <Button type="button" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button type="button" size="sm" onClick={() => setShowAssets((value) => !value)}>
              {showAssets ? 'Hide photos' : 'Photos'}
            </Button>
            <form action={deleteAction}>
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="galleryId" value={galleryId} />
              <Button type="submit" variant="danger" size="sm" aria-label="Remove section">
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </form>
          </div>
        )}
      </div>

      {deleteState.error ? (
        <div className="mt-2">
          <ErrorNote>{deleteState.error}</ErrorNote>
        </div>
      ) : null}

      {showAssets ? (
        <AssetChecklist galleryId={galleryId} sectionId={section.id} assets={assets} memberIds={memberIds} />
      ) : null}
    </li>
  );
}

function AssetChecklist({
  galleryId,
  sectionId,
  assets,
  memberIds,
}: {
  galleryId: string;
  sectionId: string;
  assets: AssetOption[];
  memberIds: Set<string>;
}) {
  const [, toggleAction] = useActionState(toggleSectionAsset, GALLERY_ADMIN_IDLE);
  const [filter, setFilter] = useState('');

  const visible = filter
    ? assets.filter((asset) => asset.filename.toLowerCase().includes(filter.toLowerCase()))
    : assets;

  return (
    <div className="mt-4 rounded-md border border-subtle p-3">
      <Input
        placeholder="Filter by filename…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className="mb-2"
      />
      <ul className="max-h-64 space-y-0.5 overflow-y-auto">
        {visible.map((asset) => (
          <li key={asset.id}>
            <form action={toggleAction}>
              <input type="hidden" name="sectionId" value={sectionId} />
              <input type="hidden" name="galleryId" value={galleryId} />
              <input type="hidden" name="assetId" value={asset.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-hover"
              >
                <input type="checkbox" readOnly checked={memberIds.has(asset.id)} className="size-4 accent-accent" />
                <span className="truncate text-foreground">{asset.filename}</span>
              </button>
            </form>
          </li>
        ))}
        {visible.length === 0 ? <li className="px-2 py-1 text-xs text-muted">No matches.</li> : null}
      </ul>
    </div>
  );
}
