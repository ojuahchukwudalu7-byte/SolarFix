-- ============================================================
-- SolarFix Inventory & Repair Manager — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- 1. PROFILES ----------
-- One row per staff member, linked 1:1 to Supabase Auth's auth.users.
-- role is the single source of truth for permissions (enforced below via RLS).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','secretary','worker')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone logged in can see the staff list (needed for "assigned technician" dropdowns etc).
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Only admins can create/edit/deactivate staff accounts.
create policy "profiles_admin_manage"
  on public.profiles for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Bootstrap-only hole: lets a freshly signed-up user create THEIR OWN admin
-- profile row, but only while zero admins exist anywhere yet. The moment the
-- first admin profile is created, this policy stops matching for everyone
-- (including that same user) — so it cannot be used to self-promote later.
create policy "profiles_bootstrap_first_admin"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role = 'admin'
    and not exists (select 1 from public.profiles p where p.role = 'admin')
  );


-- ---------- 2. INVENTORY ITEMS ----------
-- One flexible table for every stock category from the paper log books.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'Lithium Battery','Tubular Battery','Breaker','Panel',
    'Inverter','Transformer Base','Surge Protective Device','Fire Extinguisher','Other'
  )),
  name text not null,               -- e.g. brand/model: "LV Topsun", "Soccer Power"
  spec_1 text,                      -- e.g. size: "15kWh", "750 Watts", "63A"
  spec_2 text,                      -- e.g. volts: "48V", "220V"
  spec_3 text,                      -- e.g. type: "Single", "Double"
  quantity integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 2,
  unit_cost numeric(12,2),          -- optional, used for future value reporting
  notes text,
  created_by uuid references public.profiles(id),
  last_updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_category on public.inventory_items(category);
create index if not exists idx_inventory_low_stock on public.inventory_items(quantity, low_stock_threshold);

alter table public.inventory_items enable row level security;

-- Anyone logged in (any of the 3 roles) can view inventory.
create policy "inventory_select_all"
  on public.inventory_items for select
  to authenticated
  using (true);

-- Worker, Secretary, Admin can all add new stock records.
create policy "inventory_insert_staff"
  on public.inventory_items for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active
    and p.role in ('worker','secretary','admin')
  ));

-- Only Secretary and Admin can edit existing records (e.g. correct a quantity, rename).
create policy "inventory_update_secretary_admin"
  on public.inventory_items for update
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active
    and p.role in ('secretary','admin')
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active
    and p.role in ('secretary','admin')
  ));

-- Only Admin can delete inventory records outright.
create policy "inventory_delete_admin_only"
  on public.inventory_items for delete
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin'
  ));


-- ---------- 3. INVENTORY LOG ----------
-- Append-only audit trail of every stock movement. This is what powers the
-- daily report and "what to reorder" charts. Never edited, only inserted.
create table if not exists public.inventory_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name_snapshot text not null,   -- kept even if item is later deleted
  category text not null,
  action text not null check (action in ('added','removed','adjusted','used_in_repair')),
  quantity_change integer not null,   -- positive for additions, negative for removals
  resulting_quantity integer not null,
  actor_id uuid references public.profiles(id),
  actor_name_snapshot text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_log_created_at on public.inventory_log(created_at);
create index if not exists idx_log_actor on public.inventory_log(actor_id);

alter table public.inventory_log enable row level security;

create policy "log_select_all"
  on public.inventory_log for select
  to authenticated
  using (true);

-- Anyone active can write a log entry (it always fires alongside an inventory insert/update).
create policy "log_insert_staff"
  on public.inventory_log for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active
  ));

-- Nobody may update or delete log rows — it's an audit trail (admins included).
-- (No update/delete policy = denied by default under RLS.)


-- ---------- 4. REPAIRS ----------
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,          -- human-friendly, e.g. R-0001
  customer_name text not null,
  customer_phone text,
  device_description text not null,
  issue_description text not null,
  status text not null default 'Diagnosis' check (status in (
    'Received','Diagnosis','Awaiting Approval','Repair In Progress',
    'Waiting Parts','Testing','Completed','Ready for Collection','Collected'
  )),
  assigned_to uuid references public.profiles(id),
  labor_cost numeric(12,2) default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.repairs enable row level security;

create policy "repairs_select_all"
  on public.repairs for select
  to authenticated
  using (true);

create policy "repairs_insert_staff"
  on public.repairs for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active));

create policy "repairs_update_staff"
  on public.repairs for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active));

create policy "repairs_delete_admin_only"
  on public.repairs for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin'));


-- ---------- 5. REPAIR PARTS USED ----------
-- Links a repair to inventory items consumed, so stock auto-deducts.
create table if not exists public.repair_parts (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  item_id uuid references public.inventory_items(id),
  item_name_snapshot text not null,
  quantity_used integer not null check (quantity_used > 0),
  created_at timestamptz not null default now()
);

alter table public.repair_parts enable row level security;

create policy "repair_parts_select_all"
  on public.repair_parts for select
  to authenticated
  using (true);

create policy "repair_parts_insert_staff"
  on public.repair_parts for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.active));

create policy "repair_parts_delete_secretary_admin"
  on public.repair_parts for delete
  to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role in ('secretary','admin')
  ));


-- ---------- 6. Helper: keep updated_at fresh ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_inventory_updated_at on public.inventory_items;
create trigger trg_inventory_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_repairs_updated_at on public.repairs;
create trigger trg_repairs_updated_at
  before update on public.repairs
  for each row execute function public.set_updated_at();


-- ---------- 7. First admin account ----------
-- Nothing to run here — use the "Create the first admin account" link on the
-- app's own login screen. It signs up the account and inserts its own
-- profile row as the very first admin (see the bootstrap policy above,
-- which only allows this once, before any admin exists).
--
-- If you'd rather do it by hand instead, you can still run this after
-- signing the user up from Supabase Dashboard → Authentication → Users:
--
-- insert into public.profiles (id, full_name, role)
-- select id, 'YOUR NAME', 'admin' from auth.users where email = 'you@example.com'
-- on conflict (id) do update set role = 'admin';
