-- ============================================================
-- easyCater – Initial 12-Table Schema
-- ============================================================
-- Tables (in dependency order):
--  1. profiles           – user/employee accounts (extends auth.users)
--  2. catalog_categories – grouping for catalogue items
--  3. catalog_items      – product/service catalogue
--  4. customers          – CRM: client companies
--  5. customer_contacts  – contact persons per customer
--  6. events             – catering events (central order entity)
--  7. offers             – versioned quotes per event
--  8. offer_items        – line items within an offer
--  9. staff_members      – employable staff
-- 10. equipment_items    – physical equipment inventory
-- 11. event_staff        – staff assignments per event
-- 12. invoices           – billing records

create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
create type event_status as enum (
  'anfrage',        -- Request received
  'angebot',        -- Offer sent
  'bestaetigt',     -- Confirmed
  'durchfuehrung',  -- In execution
  'abrechnung',     -- Billing phase
  'abgeschlossen',  -- Completed
  'storniert'       -- Cancelled
);

create type offer_status as enum (
  'entwurf',     -- Draft
  'gesendet',    -- Sent
  'angenommen',  -- Accepted
  'abgelehnt',   -- Rejected
  'abgelaufen'   -- Expired
);

create type invoice_status as enum (
  'entwurf',       -- Draft
  'gesendet',      -- Sent
  'bezahlt',       -- Paid
  'ueberfaellig',  -- Overdue
  'storniert'      -- Cancelled
);

create type catalog_item_type as enum (
  'menu',       -- Food / menu package
  'getraenke',  -- Drinks
  'personal',   -- Staffing service
  'equipment',  -- Equipment rental
  'logistik',   -- Logistics / transport
  'sonstiges'   -- Other
);

create type staff_role as enum (
  'kueche',      -- Kitchen
  'service',     -- Waitstaff / service
  'logistik',    -- Logistics / driver
  'management',  -- Event management
  'sonstiges'    -- Other
);

-- ============================================================
-- 1. profiles
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  avatar_url  text,
  role        text not null default 'mitarbeiter', -- 'admin'|'manager'|'mitarbeiter'
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table profiles is 'Extended user profiles linked to Supabase auth.users.';

-- ============================================================
-- 2. catalog_categories
-- ============================================================
create table catalog_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
comment on table catalog_categories is 'Taxonomy for catalog items (e.g. Vorspeisen, Hauptgerichte, Technik).';

-- ============================================================
-- 3. catalog_items
-- ============================================================
create table catalog_items (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references catalog_categories(id) on delete set null,
  type             catalog_item_type not null,
  name             text not null,
  description      text,
  unit             text not null default 'Stk',
  unit_price_cents integer not null default 0,
  tax_rate_pct     numeric(5,2) not null default 19.00,
  is_active        boolean not null default true,
  image_url        text,
  metadata         jsonb,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table catalog_items is 'Product/service catalogue: menus, drinks, staffing, equipment, logistics.';
create index catalog_items_type_idx on catalog_items(type);
create index catalog_items_category_id_idx on catalog_items(category_id);

-- ============================================================
-- 4. customers
-- ============================================================
create table customers (
  id               uuid primary key default gen_random_uuid(),
  company_name     text not null,
  industry         text,
  street           text,
  city             text,
  postal_code      text,
  country          text not null default 'DE',
  notes            text,
  preferences      jsonb,
  is_repeat_client boolean not null default false,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table customers is 'CRM – client companies. Repeat-client flag for quick recognition.';
create index customers_name_fts_idx on customers using gin (to_tsvector('german', company_name));

-- ============================================================
-- 5. customer_contacts
-- ============================================================
create table customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  full_name   text not null,
  title       text,
  email       text,
  phone       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);
comment on table customer_contacts is 'Individual contact persons within a customer organisation.';
create index customer_contacts_customer_id_idx on customer_contacts(customer_id);

-- ============================================================
-- 6. events
-- ============================================================
create table events (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references customers(id) on delete restrict,
  primary_contact_id uuid references customer_contacts(id) on delete set null,
  title              text not null,
  status             event_status not null default 'anfrage',
  event_date         date not null,
  start_time         time,
  end_time           time,
  location_name      text,
  location_address   text,
  guest_count        integer not null default 0,
  budget_cents       integer,
  internal_notes     text,
  created_by         uuid references profiles(id) on delete set null,
  assigned_to        uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table events is 'Central catering event / order. Lifecycle: anfrage → abgeschlossen.';
create index events_event_date_idx on events(event_date);
create index events_customer_id_idx on events(customer_id);
create index events_status_idx on events(status);

-- ============================================================
-- 7. offers
-- ============================================================
create table offers (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  version         integer not null default 1,
  status          offer_status not null default 'entwurf',
  valid_until     date,
  total_net_cents integer not null default 0,
  tax_rate_pct    numeric(5,2) not null default 19.00,
  discount_cents  integer not null default 0,
  notes           text,
  sent_at         timestamptz,
  accepted_at     timestamptz,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (event_id, version)
);
comment on table offers is 'Versioned quotes for an event. Supports multiple revision rounds.';
create index offers_event_id_idx on offers(event_id);

-- ============================================================
-- 8. offer_items
-- ============================================================
create table offer_items (
  id               uuid primary key default gen_random_uuid(),
  offer_id         uuid not null references offers(id) on delete cascade,
  catalog_item_id  uuid references catalog_items(id) on delete set null,
  position         integer not null default 0,
  label            text not null,
  description      text,
  quantity         numeric(10,3) not null default 1,
  unit             text not null default 'Stk',
  unit_price_cents integer not null default 0,
  total_cents      integer generated always as (round(quantity * unit_price_cents)) stored,
  created_at       timestamptz not null default now()
);
comment on table offer_items is 'Line items in an offer. Price is snapshotted at creation.';
create index offer_items_offer_id_idx on offer_items(offer_id);

-- ============================================================
-- 9. staff_members
-- ============================================================
create table staff_members (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid unique references profiles(id) on delete set null,
  first_name        text not null,
  last_name         text not null,
  email             text unique,
  phone             text,
  role              staff_role not null default 'service',
  hourly_rate_cents integer not null default 0,
  skills            text[],
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table staff_members is 'Employable staff with roles, skills, and hourly rates.';
create index staff_members_role_idx on staff_members(role);

-- ============================================================
-- 10. equipment_items
-- ============================================================
create table equipment_items (
  id               uuid primary key default gen_random_uuid(),
  catalog_item_id  uuid references catalog_items(id) on delete set null,
  serial_number    text,
  name             text not null,
  description      text,
  quantity_total   integer not null default 1,
  daily_rate_cents integer not null default 0,
  condition        text not null default 'gut',  -- 'neu'|'gut'|'gebraucht'|'defekt'
  storage_location text,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table equipment_items is 'Physical equipment inventory.';
create index equipment_items_name_idx on equipment_items(name);

-- ============================================================
-- 11. event_staff
-- ============================================================
create table event_staff (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  staff_member_id uuid not null references staff_members(id) on delete restrict,
  role_override   staff_role,
  start_time      timestamptz,
  end_time        timestamptz,
  hours_worked    numeric(5,2),
  confirmed       boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (event_id, staff_member_id)
);
comment on table event_staff is 'Staff assignments per event. Used for calendar conflict detection.';
create index event_staff_event_id_idx on event_staff(event_id);
create index event_staff_staff_member_id_idx on event_staff(staff_member_id);

-- ============================================================
-- 12. invoices
-- ============================================================
create table invoices (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete restrict,
  offer_id          uuid references offers(id) on delete set null,
  invoice_number    text unique,
  status            invoice_status not null default 'entwurf',
  issued_date       date not null default current_date,
  due_date          date,
  total_net_cents   integer not null default 0,
  tax_rate_pct      numeric(5,2) not null default 19.00,
  total_gross_cents integer generated always as (
    round(total_net_cents * (1 + tax_rate_pct / 100.0))
  ) stored,
  paid_at           timestamptz,
  payment_method    text,
  notes             text,
  pdf_url           text,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table invoices is 'Billing records. invoice_number is auto-generated via trigger.';
create index invoices_event_id_idx on invoices(event_id);
create index invoices_status_idx on invoices(status);

-- ============================================================
-- Auto-increment invoice numbers  EC-YYYY-NNNN
-- ============================================================
create sequence invoice_number_seq start 1;

create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
begin
  new.invoice_number :=
    'EC-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('invoice_number_seq')::text, 4, '0');
  return new;
end;
$$;

create trigger set_invoice_number
  before insert on invoices
  for each row
  when (new.invoice_number is null)
  execute function generate_invoice_number();

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at        before update on profiles        for each row execute function touch_updated_at();
create trigger customers_updated_at       before update on customers       for each row execute function touch_updated_at();
create trigger events_updated_at          before update on events          for each row execute function touch_updated_at();
create trigger offers_updated_at          before update on offers          for each row execute function touch_updated_at();
create trigger catalog_items_updated_at   before update on catalog_items   for each row execute function touch_updated_at();
create trigger staff_members_updated_at   before update on staff_members   for each row execute function touch_updated_at();
create trigger equipment_items_updated_at before update on equipment_items for each row execute function touch_updated_at();
create trigger invoices_updated_at        before update on invoices        for each row execute function touch_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table profiles           enable row level security;
alter table catalog_categories enable row level security;
alter table catalog_items      enable row level security;
alter table customers          enable row level security;
alter table customer_contacts  enable row level security;
alter table events             enable row level security;
alter table offers             enable row level security;
alter table offer_items        enable row level security;
alter table staff_members      enable row level security;
alter table equipment_items    enable row level security;
alter table event_staff        enable row level security;
alter table invoices           enable row level security;

create policy "Auth read/write" on profiles           for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on catalog_categories for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on catalog_items      for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on customers          for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on customer_contacts  for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on events             for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on offers             for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on offer_items        for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on staff_members      for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on equipment_items    for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on event_staff        for all using (auth.role() = 'authenticated');
create policy "Auth read/write" on invoices           for all using (auth.role() = 'authenticated');

create policy "Own profile update" on profiles
  for update using (auth.uid() = id);

-- ============================================================
-- Seed: default catalog categories
-- ============================================================
insert into catalog_categories (name, description, sort_order) values
  ('Vorspeisen',          'Kalte und warme Vorspeisen',                  1),
  ('Hauptgerichte',       'Fleisch, Fisch und vegetarische Gerichte',    2),
  ('Desserts',            'Süßspeisen und Dessertbuffets',               3),
  ('Getränkepakete',      'Soft Drinks, Wein, Bier, Cocktails',          4),
  ('Servicepersonal',     'Servicekräfte und Barkeeper',                 5),
  ('Technik & Equipment', 'Zelte, Tische, Stühle, AV-Technik',          6),
  ('Logistik',            'Transport, Aufbau, Abbau',                    7);
