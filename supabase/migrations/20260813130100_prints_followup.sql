-- Print sales follow-up.  [agent B]
--
-- Seeds a starter catalogue of standard UK print/frame/canvas sizes, mapped
-- onto the mock lab's SKUs (see packages/core/src/integrations/mock.ts,
-- MOCK_LAB_CATALOGUE) so margin is visible out of the box.
--
-- This is data, not app logic: the studio can edit, reprice, retire or add to
-- every one of these rows from /store/catalogue. `on conflict do nothing`
-- makes re-running this migration harmless if a studio has already touched a
-- row with the same SKU.

set lock_timeout = '10s';

insert into public.print_products
  (sku, name, category, size_label, width_mm, height_mm, lab_sku, currency, unit_cost, price, is_digital, sort_order)
values
  ('PRINT-6X4',        '6x4" print',          'print',  '6x4"',   152, 102, 'PR-6X4',       'GBP',    45,   250, false, 10),
  ('PRINT-7X5',        '7x5" print',          'print',  '7x5"',   178, 127, 'PR-7X5',       'GBP',    70,   350, false, 20),
  ('PRINT-10X8',       '10x8" print',         'print',  '10x8"',  254, 203, 'PR-10X8',      'GBP',   180,   900, false, 30),
  ('PRINT-12X8',       '12x8" print',         'print',  '12x8"',  305, 203, 'PR-12X8',      'GBP',   240,  1200, false, 40),
  ('PRINT-16X12',      '16x12" print',        'print',  '16x12"', 406, 305, 'PR-16X12',     'GBP',   520,  2800, false, 50),
  ('PRINT-20X16',      '20x16" print',        'print',  '20x16"', 508, 406, 'PR-20X16',     'GBP',   890,  4500, false, 60),
  ('MOUNT-10X8',       '10x8" mounted print', 'framed', '10x8"',  254, 203, 'MT-10X8',      'GBP',   640,  3200, false, 70),
  ('FRAME-16X12-OAK',  '16x12" framed, oak',  'framed', '16x12"', 406, 305, 'FR-16X12-OAK', 'GBP',  3400,  8900, false, 80),
  ('FRAME-20X16-BLACK','20x16" framed, black','framed', '20x16"', 508, 406, 'FR-20X16-BLK', 'GBP',  4700, 12000, false, 90),
  ('CANVAS-24X16',     '24x16" canvas wrap',  'canvas', '24x16"', 610, 406, 'CV-24X16',     'GBP',  3900, 11000, false, 100),
  ('ALBUM-12X12-30',   '12x12" album, 30 sides', 'album', '12x12"', 305, 305, 'AL-12X12-30', 'GBP', 14500, 32500, false, 110),
  -- No lab SKU and no physical size: a digital download never reaches the lab
  -- adapter at all, which is exactly what `is_digital` exists to signal.
  ('DIGITAL-HIRES',    'High-resolution digital download', 'digital', null, null, null, null, 'GBP', 0, 1500, true, 120)
on conflict (sku) do nothing;
