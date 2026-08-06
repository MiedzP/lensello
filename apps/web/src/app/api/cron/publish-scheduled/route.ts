/**
 * Publishes campaign posts whose scheduled time has arrived.
 *
 * Closes the gap the README calls out: until now a post could be set to
 * `scheduled` and would sit there forever, because nothing ever came back to
 * publish it.
 *
 * Authentication is the shared secret in `CRON_SECRET`, which Vercel Cron sends
 * as `Authorization: Bearer <secret>`. There is no user session here, so the
 * service-role client is used — which also means this endpoint must refuse to
 * run at all when the secret is unset, rather than defaulting to open. An
 * unauthenticated caller could otherwise publish the studio's drafts.
 *
 * The publishing rules are not reimplemented: it calls the same
 * `publishOnePost` the manual publish button uses, so a post cannot behave one
 * way by hand and another way on a timer.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishOnePost } from '@/lib/campaigns/publish';

/**
 * Bounded so one run cannot exceed the function timeout and get killed
 * half-way. Anything left over is picked up on the next tick — the query is
 * ordered oldest-first, so a backlog drains in order rather than starving.
 */
const BATCH_SIZE = 25;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    // Fail closed and say why. A 503 here is an operator error, not a caller
    // error, and it should be obvious in the cron logs.
    return NextResponse.json(
      { error: 'CRON_SECRET is not set, so the scheduled publisher is disabled.' },
      { status: 503 },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from('campaign_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[cron] could not read scheduled posts', error);
    return NextResponse.json(
      { error: `Could not read scheduled posts: ${error.message}` },
      { status: 500 },
    );
  }

  const posts = due ?? [];
  const results: Array<{ id: string; ok: boolean; detail: string }> = [];

  // Sequential on purpose. These calls hit a rate-limited third-party API, and
  // a burst of parallel publishes is the fastest way to get the studio's
  // account throttled.
  for (const post of posts) {
    const outcome = await publishOnePost(admin, post);
    results.push({ id: post.id, ok: outcome.ok, detail: outcome.detail });
  }

  const published = results.filter((result) => result.ok).length;
  const failed = results.length - published;

  if (results.length > 0) {
    revalidatePath('/campaigns');
    for (const post of posts) {
      revalidatePath(`/campaigns/${post.campaign_id}`);
    }
  }

  // Failures are reported in the body, not as a non-200. A post the platform
  // rejected is a recorded outcome, not a broken cron — returning 500 would
  // make Vercel's cron log say the job failed when it did exactly its job.
  console.log(`[cron] scheduled publish: ${published} published, ${failed} failed`);

  return NextResponse.json({
    checkedAt: now,
    due: posts.length,
    published,
    failed,
    results,
  });
}
