-- Academy follow-up: seeds the course structure and worksheet field
-- definitions.  [agent G]
--
-- What this does NOT do: write lesson bodies. `body_md` stays `''` for every
-- lesson below — the studio writes that content herself through the in-app
-- editor. Nothing here is specific to one studio's name, prices, or region,
-- so the same seed works for any photography business using the platform.
--
set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- correction to 20260813120600_academy.sql
-- ---------------------------------------------------------------------------

-- That migration allowed `profile_key = 'pricing'` while the column it rolls
-- up into is `business_profile.price_point`. Every other allowed value is
-- spelled exactly like its target column, so the odd one out was the kind of
-- near-miss that reads as correct and silently writes nowhere.
--
-- Renamed rather than worked around: an enum whose values are "the column
-- name, except this one" needs a lookup table in every reader, and the next
-- person to add a worksheet would not know that.
--
-- Repeated here rather than only fixed at source because 20260813120600 may
-- already have been applied. Dropping the constraint first makes this safe to
-- run either way.
alter table public.academy_worksheets
  drop constraint if exists academy_worksheets_profile_key_check;

update public.academy_worksheets
   set profile_key = 'price_point'
 where profile_key = 'pricing';

alter table public.academy_worksheets
  add constraint academy_worksheets_profile_key_check
  check (profile_key is null or profile_key in
    ('swot', 'seven_ps', 'positioning', 'target_client',
     'customer_journey', 'brand_voice', 'price_point'));

-- ---------------------------------------------------------------------------
-- modules
-- ---------------------------------------------------------------------------

insert into public.academy_modules (slug, title, summary, icon, sort_order) values
  ('seo', 'SEO', 'Getting found in search — the fundamentals for a photography business.', 'Search', 0),
  ('geo', 'GEO', 'Generative Engine Optimisation — showing up in AI-generated answers, not just search results.', 'Sparkles', 1),
  ('swot', 'SWOT Analysis', 'A clear-eyed look at your strengths, weaknesses, opportunities and threats.', 'Grid2x2', 2),
  ('seven-ps', 'The 7 Ps of Marketing', 'Product, price, place, promotion, people, process, physical evidence.', 'LayoutGrid', 3),
  ('brand-positioning', 'Brand Positioning', 'Who you''re for, what makes you different, and what you charge for it.', 'Target', 4),
  ('nurturing-expectations', 'Nurturing Expectations', 'Keeping clients informed and confident from enquiry to delivery.', 'HeartHandshake', 5),
  ('workflows', 'Workflows', 'Repeatable steps, so nothing depends on memory.', 'Workflow', 6),
  ('website-flow', 'Website Flow', 'How a visitor moves through your site, from first click to enquiry.', 'LayoutTemplate', 7),
  ('customer-journey', 'Customer Journey', 'Every stage a client passes through, and what they experience at each one.', 'Route', 8),
  ('landing-pages', 'Landing Pages', 'Focused pages built to convert one kind of visitor into one kind of action.', 'FileText', 9),
  ('community', 'Community', 'Where photographers using this platform learn from each other.', 'Users', 10);

-- ---------------------------------------------------------------------------
-- lessons — titles and ordering only, body_md stays empty
-- ---------------------------------------------------------------------------

insert into public.academy_lessons (module_id, slug, title, summary, sort_order) values
  ((select id from public.academy_modules where slug = 'seo'),
   'fundamentals', 'SEO Fundamentals', 'The basics of being found in search results.', 0),
  ((select id from public.academy_modules where slug = 'seo'),
   'local-seo', 'Local SEO', 'Showing up for searches near where you shoot.', 1),

  ((select id from public.academy_modules where slug = 'geo'),
   'introduction', 'What GEO Is, and Why It Matters', 'How AI answer engines decide who to recommend.', 0),
  ((select id from public.academy_modules where slug = 'geo'),
   'optimising-for-ai', 'Optimising for AI Answers', 'Making your content easy for an AI to cite.', 1),

  ((select id from public.academy_modules where slug = 'swot'),
   'running-a-swot', 'Running a SWOT Analysis', 'Strengths, weaknesses, opportunities, threats — honestly assessed.', 0),

  ((select id from public.academy_modules where slug = 'seven-ps'),
   'the-7-ps', 'The 7 Ps Explained', 'A full walk through product, price, place, promotion, people, process, physical evidence.', 0),

  ((select id from public.academy_modules where slug = 'brand-positioning'),
   'positioning-statement', 'Your Positioning Statement', 'What makes you different, in one or two sentences.', 0),
  ((select id from public.academy_modules where slug = 'brand-positioning'),
   'target-client', 'Your Target Client', 'Who you are actually trying to reach.', 1),
  ((select id from public.academy_modules where slug = 'brand-positioning'),
   'brand-voice', 'Brand Voice', 'How you sound, everywhere you write.', 2),
  ((select id from public.academy_modules where slug = 'brand-positioning'),
   'pricing-strategy', 'Pricing Strategy', 'Where you sit on price, and why.', 3),

  ((select id from public.academy_modules where slug = 'nurturing-expectations'),
   'setting-expectations', 'Setting Expectations Early', 'What a client should know before they book.', 0),
  ((select id from public.academy_modules where slug = 'nurturing-expectations'),
   'keeping-clients-informed', 'Keeping Clients Informed', 'Communication between booking and delivery.', 1),

  ((select id from public.academy_modules where slug = 'workflows'),
   'building-workflows', 'Building Repeatable Workflows', 'Turning what you do from memory into a checklist.', 0),

  ((select id from public.academy_modules where slug = 'website-flow'),
   'mapping-website-flow', 'Mapping Your Website Flow', 'How a visitor actually moves through your site.', 0),

  ((select id from public.academy_modules where slug = 'customer-journey'),
   'mapping-the-journey', 'Mapping the Customer Journey', 'Every stage, and what the client experiences at each one.', 0),

  ((select id from public.academy_modules where slug = 'landing-pages'),
   'landing-pages-that-convert', 'Landing Pages That Convert', 'One page, one visitor type, one action.', 0);

-- ---------------------------------------------------------------------------
-- worksheets — the field definitions are structure, written here.
-- ---------------------------------------------------------------------------

insert into public.academy_worksheets (lesson_id, slug, title, intro, schema, profile_key, sort_order)
values
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'swot' and l.slug = 'running-a-swot'),
    'swot',
    'SWOT Worksheet',
    'Four quadrants. Be specific — "friendly service" is not a strength a competitor can''t also claim.',
    '[
      {"key": "strengths", "label": "Strengths", "type": "list",
       "help": "What do you do better than most competitors? One per line."},
      {"key": "weaknesses", "label": "Weaknesses", "type": "list",
       "help": "Where do you fall short, or what do competitors do better? One per line."},
      {"key": "opportunities", "label": "Opportunities", "type": "list",
       "help": "External trends or gaps you could take advantage of. One per line."},
      {"key": "threats", "label": "Threats", "type": "list",
       "help": "External risks: competitors, market shifts, price pressure. One per line."}
    ]'::jsonb,
    'swot',
    0
  ),
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'seven-ps' and l.slug = 'the-7-ps'),
    'seven-ps',
    '7 Ps Worksheet',
    'Seven prompts, one per P. Skip any that genuinely do not apply to how you sell.',
    '[
      {"key": "product", "label": "Product", "type": "textarea",
       "help": "What are you actually selling — the shoot, the prints, the experience?"},
      {"key": "price", "label": "Price", "type": "textarea",
       "help": "How is it priced, and what does that price signal?"},
      {"key": "place", "label": "Place", "type": "textarea",
       "help": "Where clients find and book you — studio, on location, online."},
      {"key": "promotion", "label": "Promotion", "type": "textarea",
       "help": "How prospective clients hear about you."},
      {"key": "people", "label": "People", "type": "textarea",
       "help": "Who the client deals with, and what that says about you."},
      {"key": "process", "label": "Process", "type": "textarea",
       "help": "The steps a client goes through, from enquiry to delivery."},
      {"key": "physical_evidence", "label": "Physical Evidence", "type": "textarea",
       "help": "What a client can see or hold that proves the quality — prints, packaging, the studio itself."}
    ]'::jsonb,
    'seven_ps',
    0
  ),
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'brand-positioning' and l.slug = 'positioning-statement'),
    'positioning',
    'Positioning Worksheet',
    'Work through the questions, then write the statement last — it should follow from the answers above it.',
    '[
      {"key": "audience_gap", "label": "What gap in the market do you fill?", "type": "textarea",
       "help": "Who is underserved, and how do you serve them?"},
      {"key": "differentiators", "label": "What makes you different?", "type": "list",
       "help": "Concrete, provable differences — not just \"friendly service\". One per line."},
      {"key": "proof", "label": "What proves it?", "type": "textarea",
       "help": "Awards, press, results, before/afters, testimonials."},
      {"key": "statement", "label": "Your positioning statement", "type": "textarea",
       "help": "Pull the above into one or two sentences."}
    ]'::jsonb,
    'positioning',
    0
  ),
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'brand-positioning' and l.slug = 'target-client'),
    'target-client',
    'Target Client Worksheet',
    'Describe one real kind of client, not "everyone who wants photos".',
    '[
      {"key": "demographics", "label": "Who are they?", "type": "textarea",
       "help": "Age range, life stage, location, budget."},
      {"key": "motivations", "label": "What are they trying to achieve by hiring you?", "type": "textarea"},
      {"key": "objections", "label": "What makes them hesitate to book?", "type": "textarea"},
      {"key": "summary", "label": "Describe your ideal client in a few sentences", "type": "textarea",
       "help": "This is what shows on the business profile."}
    ]'::jsonb,
    'target_client',
    0
  ),
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'brand-positioning' and l.slug = 'brand-voice'),
    'brand-voice',
    'Brand Voice Worksheet',
    'Voice is what stays consistent whether you are writing an email or an Instagram caption.',
    '[
      {"key": "adjectives", "label": "Three words that describe how you sound", "type": "list"},
      {"key": "not_this", "label": "How you don''t want to sound", "type": "textarea"},
      {"key": "example", "label": "An example line of copy in your voice", "type": "textarea"},
      {"key": "summary", "label": "Describe your brand voice in a few sentences", "type": "textarea",
       "help": "This is what shows on the business profile."}
    ]'::jsonb,
    'brand_voice',
    0
  ),
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'brand-positioning' and l.slug = 'pricing-strategy'),
    'pricing',
    'Pricing Worksheet',
    'Where you sit on price is a positioning decision, not just arithmetic.',
    '[
      {"key": "model", "label": "How do you price?", "type": "text",
       "help": "Packages, a la carte, hourly, day rate — whatever it actually is."},
      {"key": "range", "label": "Typical price for your most common booking", "type": "text"},
      {"key": "market_position", "label": "Where do you sit versus competitors?", "type": "select",
       "options": ["Budget", "Mid-market", "Premium", "Luxury"]},
      {"key": "summary", "label": "Describe your pricing approach in a few sentences", "type": "textarea",
       "help": "This is what shows on the business profile."}
    ]'::jsonb,
    'price_point',
    0
  ),
  (
    (select l.id from public.academy_lessons l
       join public.academy_modules m on m.id = l.module_id
       where m.slug = 'customer-journey' and l.slug = 'mapping-the-journey'),
    'customer-journey',
    'Customer Journey Worksheet',
    'Five stages, in order. Describe what the client actually sees and experiences at each one.',
    '[
      {"key": "awareness", "label": "Awareness", "type": "textarea",
       "help": "How do they first hear about you?"},
      {"key": "first_contact", "label": "First contact", "type": "textarea",
       "help": "What happens between them finding you and getting in touch?"},
      {"key": "booking", "label": "Booking", "type": "textarea",
       "help": "What does the enquiry-to-booked-and-paid process look like?"},
      {"key": "delivery", "label": "Delivery", "type": "textarea",
       "help": "The shoot itself, through to receiving their photos."},
      {"key": "referral", "label": "Follow-up and referral", "type": "textarea",
       "help": "What happens after delivery — and what makes them recommend you?"}
    ]'::jsonb,
    'customer_journey',
    0
  );

-- ---------------------------------------------------------------------------
-- resources — the Skool community is an outbound link, not a rebuilt forum.
-- URL left blank: it is studio-specific and does not belong in a migration
-- meant to seed any photography business's academy. The studio adds its own
-- link through the resource editor.
-- ---------------------------------------------------------------------------

insert into public.academy_resources (module_id, title, description, kind, url, sort_order)
values (
  (select id from public.academy_modules where slug = 'community'),
  'Community',
  'Your community group — add the link once it is live.',
  'community',
  null,
  0
);
