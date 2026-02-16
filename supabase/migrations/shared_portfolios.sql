-- Shared portfolios: admin-created, publicly accessible portfolio views
-- Each row stores a named set of asset slugs that renders at /p/[slug]

create table if not exists shared_portfolios (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text,
  logo_domain text,
  asset_slugs text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- If the table already exists, add the column
alter table shared_portfolios add column if not exists logo_domain text;

-- Public read access (no auth needed to view a shared portfolio)
alter table shared_portfolios enable row level security;

create policy "Public read access"
  on shared_portfolios for select
  using (true);

-- Index on slug for fast lookups
create index if not exists idx_shared_portfolios_slug on shared_portfolios (slug);
