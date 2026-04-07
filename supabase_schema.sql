-- ═══════════════════════════════════════════════════════════════════════
-- Chicken Affair — SUPABASE DATABASE SCHEMA
-- Run this entire file in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════

-- ── STAFF ────────────────────────────────────────────────────────────────────
-- Stores all staff accounts linked to Supabase Auth users
CREATE TABLE staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner','manager','captain','biller')),
  avatar_url  TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── TABLES ───────────────────────────────────────────────────────────────────
-- Physical tables in the café
CREATE TABLE cafe_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number      INT NOT NULL UNIQUE,
  name        TEXT,                        -- Optional custom name e.g. "Garden 1"
  area        TEXT DEFAULT 'Main',         -- Indoor, Garden, Terrace etc.
  capacity    INT DEFAULT 4,
  status      TEXT DEFAULT 'free' CHECK (status IN ('free','occupied','bill_requested','reserved','cleaning')),
  captain_id  UUID REFERENCES staff(id),   -- Assigned captain
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── MENU CATEGORIES ──────────────────────────────────────────────────────────
CREATE TABLE menu_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── MENU ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  food_type     TEXT DEFAULT 'veg' CHECK (food_type IN ('veg','non_veg','egg')),
  is_available  BOOLEAN DEFAULT true,
  is_featured   BOOLEAN DEFAULT false,      -- Chef's Special / Recommended
  image_url     TEXT,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── ITEM VARIANTS ────────────────────────────────────────────────────────────
-- e.g. Cappuccino: Small/Medium/Large with different prices
CREATE TABLE item_variants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id   UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,               -- "Small", "Medium", "Large"
  price     NUMERIC(10,2) NOT NULL
);

-- ── ITEM ADDONS ──────────────────────────────────────────────────────────────
-- e.g. Extra shot (+Rs.30), Extra cheese (+Rs.20)
CREATE TABLE item_addons (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id   UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  price     NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ── ORDERS ───────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      UUID REFERENCES cafe_tables(id),
  captain_id    UUID REFERENCES staff(id),
  order_type    TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in','takeaway','walk_in')),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','billed','completed','cancelled')),
  covers        INT DEFAULT 1,           -- Number of guests
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- ── ORDER ITEMS ──────────────────────────────────────────────────────────────
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES menu_items(id),
  variant_id    UUID REFERENCES item_variants(id),
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL,   -- Price at time of order (never changes after)
  notes         TEXT,                     -- Special instructions
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── KOTS ─────────────────────────────────────────────────────────────────────
-- Each time items are submitted to kitchen, a KOT is created
CREATE TABLE kots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  kot_number  SERIAL,                    -- Sequential KOT number
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','ready')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  ready_at    TIMESTAMPTZ
);

-- KOT items (subset of order items that belong to this KOT)
CREATE TABLE kot_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_id        UUID REFERENCES kots(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  is_done       BOOLEAN DEFAULT false    -- Kitchen marks individual items done on KDS
);

-- ── BILLS ────────────────────────────────────────────────────────────────────
CREATE TABLE bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id),
  biller_id       UUID REFERENCES staff(id),
  subtotal        NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_reason TEXT,
  cgst            NUMERIC(10,2) DEFAULT 0,
  sgst            NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  bill_type       TEXT DEFAULT 'dine_in',
  is_complimentary BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── INVENTORY ────────────────────────────────────────────────────────────────
CREATE TABLE inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL,           -- kg, litres, pieces, grams
  current_stock NUMERIC(10,3) DEFAULT 0,
  min_stock     NUMERIC(10,3) DEFAULT 0, -- Alert threshold
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Stock movements — inward stock and wastage
CREATE TABLE stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID REFERENCES inventory_items(id),
  type        TEXT NOT NULL CHECK (type IN ('inward','wastage','auto_deduction')),
  quantity    NUMERIC(10,3) NOT NULL,
  reason      TEXT,
  recorded_by UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Enable RLS on all tables so only authenticated users can access data
ALTER TABLE staff            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_addons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (role filtering happens in app)
-- Fine-grained DB-level policies can be added later per role
CREATE POLICY "Authenticated users can do everything" ON staff           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON cafe_tables     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON menu_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON menu_items      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON item_variants   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON item_addons     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON orders          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON order_items     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON kots            FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON kot_items       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON bills           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON inventory_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON stock_movements FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- Next step: Create the first owner account in Supabase Auth,
-- then insert a row in the 'staff' table with role = 'owner'.
-- ═══════════════════════════════════════════════════════════════════════
