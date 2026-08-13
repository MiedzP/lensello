-- Print sales and lab fulfilment.  [agent B]
--
-- "Buying page — choose which one they want" and "connected to one of the
-- printing laboratories in the UK".
--
-- The lab is reached through an adapter (`@lensello/core/integrations` →
-- `printLab`), never a direct fetch, and no UK lab is wired up yet. That is why
-- an order carries both `lab_order_ref` (set when a lab accepts it) and an
-- export path: the studio can sell prints today and hand the lab a spec sheet by
-- email, then switch on a real integration later without touching this schema.
--
-- Money is integer minor units in the order's own currency. Floats do not
-- survive a VAT calculation intact, and the studio is GBP but should not be
-- hardcoded to it.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- catalogue
-- ---------------------------------------------------------------------------

create table public.print_products (
  id            uuid primary key default gen_random_uuid(),

  -- The studio's own code, shown on invoices. Distinct from lab_sku, which is
  -- whatever the lab calls the same thing and changes when the lab changes.
  sku           text not null unique,
  name          text not null,
  category      text not null default 'print'
                  check (category in ('print', 'framed', 'canvas', 'album',
                                      'wall_art', 'digital', 'package', 'other')),
  description   text,

  -- Human label ("12x8\"") kept alongside millimetres, because the label is what
  -- the client recognises and the millimetres are what crops and the lab need.
  size_label    text,
  width_mm      integer check (width_mm is null or width_mm > 0),
  height_mm     integer check (height_mm is null or height_mm > 0),

  lab_sku       text,

  currency      text not null default 'GBP' check (char_length(currency) = 3),
  -- What the lab charges. Kept so margin is visible when pricing.
  unit_cost     integer not null default 0 check (unit_cost >= 0),
  -- What the client pays, tax inclusive.
  price         integer not null default 0 check (price >= 0),

  -- A digital download has no shipping and no lab order.
  is_digital    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index print_products_active_idx
  on public.print_products (is_active, sort_order);

create trigger print_products_touch before update on public.print_products
  for each row execute function public.touch_updated_at();

comment on column public.print_products.price is
  'Minor units (pence) of print_products.currency, tax inclusive.';

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

create table public.print_orders (
  id            uuid primary key default gen_random_uuid(),

  -- Where the order came from. Both nullable: a studio can raise an order for a
  -- client with no gallery, and a gallery visitor may not be a client record yet.
  gallery_id    uuid references public.galleries (id) on delete set null,
  client_id     uuid references public.clients (id) on delete set null,

  -- 'cart' is a real state, not a UI concept: an abandoned basket that still
  -- holds crops and quantities is what lets the studio follow up on it.
  status        text not null default 'cart'
                  check (status in ('cart', 'awaiting_payment', 'paid',
                                    'submitted_to_lab', 'in_production',
                                    'shipped', 'delivered',
                                    'cancelled', 'refunded')),

  currency      text not null default 'GBP' check (char_length(currency) = 3),
  -- Totals are stored, not computed on read: a price change next month must not
  -- silently rewrite what someone already paid.
  subtotal      integer not null default 0 check (subtotal >= 0),
  shipping      integer not null default 0 check (shipping >= 0),
  tax           integer not null default 0 check (tax >= 0),
  total         integer not null default 0 check (total >= 0),

  stripe_payment_intent_id text unique,
  paid_at       timestamptz,

  -- Set when a lab accepts the order. Null while fulfilment is manual.
  lab_order_ref text,
  lab_status    text,
  lab_submitted_at timestamptz,
  tracking_url  text,

  contact_name  text,
  contact_email text,
  ship_line1    text,
  ship_line2    text,
  ship_city     text,
  ship_postcode text,
  ship_country  text not null default 'GB',

  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index print_orders_gallery_idx on public.print_orders (gallery_id);
create index print_orders_client_idx  on public.print_orders (client_id);
create index print_orders_status_idx  on public.print_orders (status, created_at desc);

create trigger print_orders_touch before update on public.print_orders
  for each row execute function public.touch_updated_at();

create table public.print_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.print_orders (id) on delete cascade,
  -- Restricted, not cascaded: deleting a catalogue entry must not quietly empty
  -- historical orders. Retire products with is_active instead.
  product_id   uuid not null references public.print_products (id) on delete restrict,
  asset_id     uuid not null references public.assets (id) on delete restrict,

  quantity     integer not null default 1 check (quantity > 0),

  -- Snapshot of the catalogue at the moment of ordering.
  unit_price   integer not null check (unit_price >= 0),
  product_name text not null default '',
  size_label   text,

  -- Normalised 0-1 rect: {"x":0,"y":0,"w":1,"h":1}. Fractions rather than
  -- pixels so the same crop applies to any rendition of the master file.
  crop         jsonb,

  created_at   timestamptz not null default now()
);

create index print_order_items_order_idx on public.print_order_items (order_id);

-- Every state change, including lab submissions and failures. When a lab
-- rejects an order at 2am this is the only record of why.
create table public.print_order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.print_orders (id) on delete cascade,
  kind       text not null,
  detail     text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

create index print_order_events_order_idx
  on public.print_order_events (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.print_products     enable row level security;
alter table public.print_orders       enable row level security;
alter table public.print_order_items  enable row level security;
alter table public.print_order_events enable row level security;

create policy print_products_staff_all on public.print_products
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy print_orders_staff_all on public.print_orders
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy print_order_items_staff_all on public.print_order_items
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy print_order_events_staff_select on public.print_order_events
  for select to authenticated using (public.is_staff());

-- The shop the client actually buys through has no session and goes via the
-- service role, same as the gallery route it hangs off.
