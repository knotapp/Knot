-- Knot Social — v2 Migration
-- Run this in Supabase SQL Editor → New query → paste & run
-- Safe to run multiple times (uses IF NOT EXISTS / on conflict do nothing)

-- ─── Add missing columns to users ────────────────────────────────────────────
alter table public.users add column if not exists banner_image  text    not null default '';
alter table public.users add column if not exists premium       boolean not null default false;
alter table public.users add column if not exists email         text    not null default '';

-- ─── Likes ───────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  user_id     text not null references public.users(id) on delete cascade,
  post_id     text not null references public.posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.likes enable row level security;
create policy "public_all" on public.likes for all using (true) with check (true);

-- ─── Post images ─────────────────────────────────────────────────────────────
alter table public.posts add column if not exists image_url text not null default '';

-- ─── Community posts ─────────────────────────────────────────────────────────
create table if not exists public.community_posts (
  id            text primary key,
  community_id  text not null references public.communities(id) on delete cascade,
  user_id       text not null references public.users(id) on delete cascade,
  content       text not null,
  created_at    timestamptz not null default now()
);

alter table public.community_posts enable row level security;
create policy "public_all" on public.community_posts for all using (true) with check (true);

-- ─── Blocks ──────────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id  text not null references public.users(id) on delete cascade,
  blocked_id  text not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;
create policy "public_all" on public.blocks for all using (true) with check (true);

-- ─── DM read receipts ────────────────────────────────────────────────────────
alter table public.direct_messages add column if not exists read boolean not null default false;

-- ─── Notification read flag ──────────────────────────────────────────────────
alter table public.notifications add column if not exists read boolean not null default false;

-- ─── Notification type (for deep linking) ────────────────────────────────────
alter table public.notifications add column if not exists type      text not null default 'general';
alter table public.notifications add column if not exists ref_id    text not null default '';
