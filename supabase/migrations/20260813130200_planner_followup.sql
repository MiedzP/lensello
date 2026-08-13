-- Seeds the builtin playbooks: the dropdown she asked for, with real prose in
-- every prompt and a real set of dated tasks in every plan. [agent C]
--
-- "Wedding season is coming to an end in September — should have a mini
-- campaign for the wedding fairs, so they can organize and book meetings at
-- fair" is the wedding-fair-season playbook below, task for task: book the
-- stand, prep the samples, work the fair, then chase every lead until it
-- either books or gets a clear answer.
--
-- Day offsets are relative to the campaign's `starts_on`. For wedding fair
-- season, autumn and christmas that anchor is the event itself (the fair, the
-- 21st, the 25th), so the run-up uses negative offsets; the seasonal
-- promotions anchor on the day the campaign launches instead.
--
-- Idempotent: re-running this file (e.g. a `supabase db push` replay) neither
-- duplicates a playbook (`on conflict (slug) do nothing`) nor its tasks (each
-- batch is guarded by a single existence check before it inserts).

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- playbooks
-- ---------------------------------------------------------------------------

insert into public.campaign_playbooks
  (slug, name, summary, season, objective, audience_template, brief_template,
   duration_days, posting_days, platforms, cover_emoji, accent_color, is_builtin, is_active)
values
  (
    'wedding-fair-season',
    'Wedding fair season',
    'Book a stand, show your strongest work, and turn stand conversations into booked consultations.',
    'wedding_fair',
    'book_more_shoots',
    'Engaged couples who have not booked a photographer yet — most are 6 to 18 months out from their wedding date and are actively comparing a handful of studios. They are at the fair to see real work up close and get a feel for who they would want in the room on the day.',
    'Wedding fair season is here. The goal is to get couples to our stand, then turn every stand conversation into a booked consultation — a meeting converts far better than a follow. Lead with our strongest full-day coverage: a couple portrait, a candid reception moment, something that shows range across light and venues. Mention any fair-only offer if we are running one, and make sure every lead we collect at the stand gets a personal follow-up within a day, not a form email a week later.',
    35,
    '{1,3,5}',
    '{instagram,facebook}',
    '💍',
    '#B5495B',
    true,
    true
  ),
  (
    'engagement-season',
    'Engagement season',
    'Reach newly engaged couples in the weeks right after proposal season, before they have booked anyone.',
    'engagement',
    'book_more_shoots',
    'Newly engaged couples in the weeks right after proposal season — most have not picked a venue or a date yet, but they are actively researching photographers on Instagram and Pinterest and want an engagement shoot booked early.',
    'The window right after a proposal is when a couple is most excited and least booked-up — reach them before they have committed to anyone else. Lead with engagement-shoot work, not just weddings: it is the lower-commitment first booking that often turns into the wedding booking too. Mention any engagement-shoot-plus-wedding bundle pricing, and ask happy past couples for referrals — proposal season produces a wave of newly engaged friends.',
    28,
    '{1,3,5}',
    '{instagram,facebook,pinterest}',
    '💎',
    '#7C5CBF',
    true,
    true
  ),
  (
    'new-year',
    'New Year',
    'A fresh-start moment to sell portraits, branding shoots, and this year''s wedding dates before they fill up.',
    'new_year',
    'seasonal_promo',
    'Everyone who follows us but has not booked anything yet, plus past clients — a fresh-start, "this is my year" mindset is when people commit to portraits, branding shoots, or finally book the wedding photographer they had been putting off.',
    'New Year is a natural moment to sell a fresh start: personal branding shoots, family portraits, or "lock in this year''s wedding photographer before dates fill up". Keep the tone upbeat and forward-looking, not just "happy new year". A time-limited offer — a discount code, first-come-first-served on early-year dates — gives people a reason to book now instead of "sometime this year".',
    14,
    '{1,3,5}',
    '{instagram,facebook}',
    '🎉',
    '#2E86AB',
    true,
    true
  ),
  (
    'valentines-day',
    'Valentine''s Day',
    'A small, clearly-priced offer — mini couples sessions or gift vouchers — timed to land before the 14th.',
    'valentines',
    'seasonal_promo',
    'Couples wanting a romantic portrait session, and anyone buying photography as a gift for someone else — print vouchers, mini-sessions, or a styled couples shoot around February 14th.',
    'Valentine''s works best as a small, clearly-priced offer: a mini couples session, a styled shoot, or a gift voucher someone can buy for a partner. Get the gift-voucher option visible early — it needs to land before the 14th, not on the day itself. Keep the imagery warm and romantic; this is broader than a wedding pitch, so do not aim it only at engaged couples.',
    21,
    '{1,3,5}',
    '{instagram,facebook}',
    '❤️',
    '#D6336C',
    true,
    true
  ),
  (
    'spring',
    'Spring',
    'Sell the light: outdoor family and maternity sessions, plus a nudge on remaining summer wedding dates.',
    'spring',
    'seasonal_promo',
    'Families and couples wanting to make the most of spring light and blossom season — outdoor family portraits, maternity and newborn sessions for spring babies, and couples still deciding on a summer wedding photographer.',
    'Spring sells on light and location: blossom, soft evening sun, the first warm weekends after winter. A good season to push family and maternity sessions outdoors, and to mention any summer wedding dates that are still open — couples finalising a summer booking are watching for exactly that. Use real local spots people will recognise rather than generic stock-style scenes.',
    30,
    '{1,3,5}',
    '{instagram,facebook,pinterest}',
    '🌸',
    '#4C956C',
    true,
    true
  ),
  (
    'summer',
    'Summer',
    'Show off this summer''s weddings while quietly opening next year''s booking window.',
    'summer',
    'seasonal_promo',
    'Couples getting married this summer and their guests, plus next year''s engaged couples who are starting to look — this is peak wedding season, so most of the audience is people already booked with us, watching what we deliver.',
    'Summer is peak wedding delivery season, so most of the content is simply showing off real weddings shot this summer — which also markets next year''s availability to anyone watching. Balance "look how good our summer weddings are" with a clear, low-pressure note that next year''s dates are booking now, since couples planning 12+ months ahead are exactly who is reading this.',
    60,
    '{1,3,5}',
    '{instagram,facebook,tiktok}',
    '☀️',
    '#E8A33D',
    true,
    true
  ),
  (
    'autumn',
    'Autumn',
    'Golden-hour imagery, plus the moment to convert this year''s leftover leads into next year''s bookings.',
    'autumn',
    'seasonal_promo',
    'Couples wanting golden-hour autumn portraits, families wanting a portrait before the year ends, and — as wedding season winds down — anyone who inquired earlier in the year but has not booked yet.',
    'Autumn light is a genuine selling point — lean on golden-hour imagery rather than generic seasonal cliches. As the wedding season tails off, this is also the moment to convert this year''s leftover inquiries into next year''s bookings before they go quiet over winter. Family portrait demand often rises here too, ahead of the holidays.',
    30,
    '{1,3,5}',
    '{instagram,facebook}',
    '🍁',
    '#B5651D',
    true,
    true
  ),
  (
    'christmas',
    'Christmas',
    'A hard deadline: festive mini sessions and gift vouchers that must be delivered before the 25th.',
    'christmas',
    'seasonal_promo',
    'Families wanting festive portraits for cards and gifts, and gift-voucher buyers — a shorter, harder deadline than Valentine''s, since prints and cards need to be ready well before the 25th.',
    'Christmas has a hard deadline: anything sold as a gift or a card needs to be shot, edited, and printed before the 25th, so push mini sessions and vouchers early and be explicit about the last order date for guaranteed delivery. Cosy, warm imagery; family and children''s sessions do best here.',
    35,
    '{1,3,5}',
    '{instagram,facebook}',
    '🎄',
    '#2F6E4F',
    true,
    true
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- tasks — one guarded batch per playbook, so re-running this file is a no-op
-- once the tasks exist.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'wedding-fair-season'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (-21, 'Book your stand', 'Confirm your pitch or table at the fair, pay any fee, and get load-in details: arrival time, parking, and whether power is available.', 'admin', null::text, 0),
      (-14, 'Order printed materials', 'Print a stand banner, a leave-behind price guide or mini brochure, and business cards. A QR code straight to your booking page saves a lead from typing your name into a search box later.', 'print', null::text, 1),
      (-10, 'Curate your sample album', 'Pick a tight, varied set of prints or an album that show breadth: a full ceremony, a candid reception moment, a couple portrait in different light. Three genuinely strong albums beat ten average ones on a table.', 'admin', null::text, 2),
      (-7, 'Announce you will be at the fair', 'Tell your audience which fair, when, and why to come find you. Tease one photo they have not seen before to give them a reason to stop at the stand.', 'post', 'instagram', 3),
      (-3, 'Email your inquiry list', 'A short note to anyone who has inquired but not booked: come and see the new album in person, and book a slot to chat properly at the fair.', 'email', null::text, 4),
      (-1, 'Pack the stand kit', 'Prints, easels or frames, price list, contract templates, a card reader, a notebook for names and dates, business cards, and anything that makes the stand feel like you.', 'admin', null::text, 5),
      (0, 'Work the fair', 'Be present and talking, not on your phone. Get a name, wedding date, and best contact for every real conversation, even the ones that do not book on the day.', 'shoot', null::text, 6),
      (1, 'Follow up every lead within 24 hours', 'A personal message referencing what you talked about beats a form email every time. Suggest a specific next step: a call, a studio visit, a quote.', 'outreach', null::text, 7),
      (3, 'Call the warmest leads', 'Anyone who seemed ready to book: call, do not just message. Offer two or three concrete date and time options for a proper consultation.', 'call', null::text, 8),
      (7, 'Second follow-up to anyone who has not replied', 'A gentle nudge with something new to look at: a link to a real wedding gallery close to their venue or style.', 'outreach', null::text, 9),
      (14, 'Close out the fair leads', 'Anyone still undecided: send a clear final offer or deadline, e.g. "this fair rate holds until [date]", so the fair converts into bookings rather than just contacts.', 'outreach', null::text, 10)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'wedding-fair-season';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'engagement-season'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (0, 'Launch with a real engagement gallery', 'Open the campaign with a genuine, recent engagement shoot rather than a generic announcement graphic.', 'post', 'instagram', 0),
      (2, 'Share a couple''s engagement story', 'A short story-format post: how they met, how they got engaged, a couple of favourite frames.', 'story', 'instagram', 1),
      (5, 'Post the packages explainer', 'A clear post covering what an engagement session includes and how it pairs with wedding packages.', 'post', 'facebook', 2),
      (7, 'Boost the top-performing engagement post', 'Put a little spend behind whichever post from the first week has the best engagement.', 'ad', null::text, 3),
      (10, 'Email past clients for referrals', 'Ask happily-married past couples to tag or refer newly engaged friends — the strongest lead source this time of year.', 'email', null::text, 4),
      (14, 'Feature an engagement-to-wedding pairing', 'Show one couple''s engagement shoot next to a moment from their wedding, to sell the relationship, not just the session.', 'post', 'instagram', 5),
      (18, 'Reach out to newly engaged inquiries individually', 'Anyone who has inquired since the campaign started: a personal message, not a broadcast.', 'outreach', null::text, 6),
      (21, 'Share this season''s booking availability', 'A clear, low-pressure post on which dates are still open for engagement sessions and weddings.', 'post', 'instagram', 7),
      (25, 'Call any warm leads still deciding', 'A short call beats another message for anyone who has gone quiet after showing real interest.', 'call', null::text, 8)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'engagement-season';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'new-year'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (-2, 'Tease the New Year offer', 'A short "something''s coming" post or story, without giving the offer away yet.', 'story', 'instagram', 0),
      (0, 'Launch the New Year offer', 'State the offer and the deadline plainly. This is the one post that needs a clear call to action: book now.', 'post', 'instagram', 1),
      (0, 'Email the New Year offer to your list', 'Same offer, same deadline, sent directly rather than left to be found.', 'email', null::text, 2),
      (3, 'Countdown story: days remaining', 'A quick reminder of how long the offer has left to run.', 'story', 'instagram', 3),
      (7, 'Message anyone who engaged with the offer post', 'A personal nudge to anyone who liked, saved, or commented but has not booked.', 'outreach', null::text, 4),
      (10, 'Last-chance reminder', 'A final push before the deadline, across whichever platform performed best so far.', 'story', 'instagram', 5),
      (13, 'Final call post', 'One last clear post: the offer ends tomorrow.', 'post', 'facebook', 6),
      (14, 'Close out the offer', 'Turn off the offer, and follow up anyone who showed interest but did not convert in time.', 'admin', null::text, 7)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'new-year';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'valentines-day'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (-14, 'Announce mini sessions or gift vouchers', 'Launch whichever offer we are running this year — a mini couples session, or a voucher someone can gift.', 'post', 'instagram', 0),
      (-10, 'Prep gift voucher materials', 'Get the voucher template or printed card ready so a purchase can be fulfilled the same day it is bought.', 'print', null::text, 1),
      (-7, 'Share a styled couples shoot', 'Post a recent, genuinely romantic session as inspiration for what a booking looks like.', 'post', 'instagram', 2),
      (-5, 'Boost the gift voucher post', 'A little spend here catches gift-buyers who are not already following us.', 'ad', null::text, 3),
      (-3, 'Email the voucher deadline for delivery', 'Make the "order by" date explicit — a voucher bought too late is a missed gift, and a lost sale.', 'email', null::text, 4),
      (-1, 'Last-minute gift voucher reminder', 'A short, urgent story: still time to buy, but only just.', 'story', 'instagram', 5),
      (0, 'Valentine''s Day post', 'A warm, on-the-day post — thank-you to anyone who booked, and a nod to the day itself.', 'post', 'instagram', 6),
      (2, 'Follow up mini-session bookings', 'Get every booked session actually scheduled to a date and time before enthusiasm cools.', 'outreach', null::text, 7)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'valentines-day';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'spring'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (0, 'Announce spring session availability', 'Open the season with a clear post: outdoor family and maternity sessions are open for booking.', 'post', 'instagram', 0),
      (4, 'Feature a family session in spring light', 'A real, recent family shoot in blossom or golden outdoor light.', 'post', 'instagram', 1),
      (8, 'Behind-the-scenes from a spring shoot', 'A relaxed, informal look at what a session actually feels like, for anyone still deciding.', 'story', 'instagram', 2),
      (12, 'Share remaining open wedding dates', 'A gentle reminder that this summer''s wedding dates are filling up, for anyone still choosing a photographer.', 'post', 'facebook', 3),
      (16, 'Boost the family-session post locally', 'Put spend behind the strongest family post, targeted to the local area.', 'ad', null::text, 4),
      (20, 'Email past family clients', 'Ask past portrait clients if they would like to book this spring''s session before slots fill.', 'email', null::text, 5),
      (25, 'Follow up warm portrait inquiries', 'Anyone who has asked about a session but not booked a date yet.', 'outreach', null::text, 6)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'spring';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'summer'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (0, 'Share the first summer wedding gallery', 'Open peak season with the strongest full gallery from a wedding shot so far this summer.', 'post', 'instagram', 0),
      (7, 'Post a full-day highlight reel', 'A short video or carousel covering getting-ready through to the reception.', 'post', 'tiktok', 1),
      (14, 'Behind the scenes at a summer wedding', 'An informal look at the day from the photographer''s side.', 'story', 'instagram', 2),
      (21, 'Feature guest and reception details', 'Table settings, favours, dancing — the details couples remember, and other vendors will reshare.', 'post', 'instagram', 3),
      (28, 'Announce next year''s date availability', 'A low-pressure note that next year''s wedding dates are open, aimed at couples watching this summer''s work.', 'post', 'facebook', 4),
      (35, 'Email engaged followers about next year''s booking window', 'A direct nudge to anyone on the list who is engaged but has not booked a photographer.', 'email', null::text, 5),
      (42, 'Share a second wedding gallery', 'Keep the season''s momentum going with another full gallery.', 'post', 'instagram', 6),
      (50, 'Reach out to mid-summer inquiries', 'Anyone who inquired earlier in the season and has gone quiet.', 'outreach', null::text, 7)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'summer';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'autumn'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (0, 'Announce autumn portrait sessions', 'Launch the season with a clear call for family and couple portrait bookings.', 'post', 'instagram', 0),
      (5, 'Feature a golden-hour shoot', 'Lean into the light — a real autumn session that shows why this season is worth booking.', 'post', 'instagram', 1),
      (10, 'Follow up unbooked wedding inquiries', 'Anyone who inquired about a wedding this year but never booked: check in about next year before they go quiet over winter.', 'outreach', null::text, 2),
      (15, 'Email: last sessions before the holidays', 'A direct reminder that portrait slots before the holiday season are limited.', 'email', null::text, 3),
      (20, 'Behind-the-scenes from an autumn shoot', 'A relaxed look at a real session in autumn light.', 'story', 'instagram', 4),
      (25, 'Share next season''s availability', 'Open the conversation about next year''s wedding season while this year is still front of mind.', 'post', 'facebook', 5)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'autumn';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.playbook_tasks pt
    join public.campaign_playbooks cp on cp.id = pt.playbook_id
    where cp.slug = 'christmas'
  ) then
    insert into public.playbook_tasks (playbook_id, day_offset, title, detail, kind, platform, sort_order)
    select cp.id, v.day_offset, v.title, v.detail, v.kind, v.platform, v.sort_order
    from public.campaign_playbooks cp,
    (values
      (-28, 'Announce mini sessions and gift vouchers', 'Open early — Christmas has the least forgiving deadline of any seasonal campaign.', 'post', 'instagram', 0),
      (-24, 'Open mini-session booking slots', 'Publish the available dates and times so people can book straight away.', 'admin', null::text, 1),
      (-18, 'Confirm print turnaround times', 'Check delivery times with the print lab now, so the "order by" date promised to clients is one you can actually hit.', 'print', null::text, 2),
      (-14, 'Share a festive family mini-session gallery', 'A warm, cosy gallery that sells the feeling, not just the offer.', 'post', 'instagram', 3),
      (-10, 'Email the guaranteed-delivery deadline', 'State plainly: order by this date for delivery before the 25th.', 'email', null::text, 4),
      (-7, 'Final reminder: order by date', 'A short, urgent story as the deadline approaches.', 'story', 'instagram', 5),
      (-3, 'Follow up unfinished voucher orders', 'Anyone who started but did not finish buying a voucher — a quick nudge often closes it.', 'outreach', null::text, 6),
      (0, 'Christmas Day post', 'A warm, low-key thank-you post — not a sales push on the day itself.', 'post', 'instagram', 7),
      (3, 'Note what sold well', 'A quick admin note on which offer, price point, or post performed best, for next year''s planning.', 'admin', null::text, 8)
    ) as v(day_offset, title, detail, kind, platform, sort_order)
    where cp.slug = 'christmas';
  end if;
end $$;
