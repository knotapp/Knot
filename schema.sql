-- Knot Social — Supabase schema
-- Run this in your Supabase project: SQL Editor → New query → paste & run

-- ─── Users ───────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id            text primary key,
  username      text unique not null,
  password      text not null,
  display_name  text not null,
  role          text not null default 'user',
  verified      boolean not null default false,
  banned        boolean not null default false,
  profile_image text not null default '',
  bio           text not null default '',
  created_at    timestamptz not null default now()
);

-- ─── Follows ─────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id   text not null references public.users(id) on delete cascade,
  following_id  text not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id)
);

-- ─── Posts ───────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id          text primary key,
  user_id     text not null references public.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ─── Comments ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id          text primary key,
  post_id     text not null references public.posts(id) on delete cascade,
  user_id     text not null references public.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ─── Bookmarks ───────────────────────────────────────────────────────────────
create table if not exists public.bookmarks (
  user_id     text not null references public.users(id) on delete cascade,
  post_id     text not null references public.posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ─── Direct Messages ─────────────────────────────────────────────────────────
create table if not exists public.direct_messages (
  id            text primary key,
  sender_id     text not null references public.users(id) on delete cascade,
  recipient_id  text not null references public.users(id) on delete cascade,
  text          text not null,
  created_at    timestamptz not null default now()
);

-- ─── Notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          text primary key,
  user_id     text not null references public.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ─── Communities ─────────────────────────────────────────────────────────────
create table if not exists public.communities (
  id          text primary key,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id  text not null references public.communities(id) on delete cascade,
  user_id       text not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- ─── Disable RLS (public app, no auth middleware) ────────────────────────────
alter table public.users              enable row level security;
alter table public.follows            enable row level security;
alter table public.posts              enable row level security;
alter table public.comments           enable row level security;
alter table public.bookmarks          enable row level security;
alter table public.direct_messages    enable row level security;
alter table public.notifications      enable row level security;
alter table public.communities        enable row level security;
alter table public.community_members  enable row level security;

-- Allow all operations via anon key (the app handles its own auth logic)
create policy "public_all" on public.users              for all using (true) with check (true);
create policy "public_all" on public.follows            for all using (true) with check (true);
create policy "public_all" on public.posts              for all using (true) with check (true);
create policy "public_all" on public.comments           for all using (true) with check (true);
create policy "public_all" on public.bookmarks          for all using (true) with check (true);
create policy "public_all" on public.direct_messages    for all using (true) with check (true);
create policy "public_all" on public.notifications      for all using (true) with check (true);
create policy "public_all" on public.communities        for all using (true) with check (true);
create policy "public_all" on public.community_members  for all using (true) with check (true);

-- ─── Seed data ───────────────────────────────────────────────────────────────
insert into public.users (id, username, password, display_name, role, verified, bio) values
  ('admin-1',   'admin',  'KnotAdmin!2026',  'Admin',    'admin', true,  'Website administrator and moderator.'),
  ('admin-2',   'admin2', 'KnotAdmin2!2026', 'Admin Two','admin', true,  'Secondary administrator account.'),
  ('user-knot', 'knot',   'KnotOwner!2026',  'Knot',     'owner', true,  'Owner of this social website.'),
  ('user-mila', 'mila',   'KnotMila!2026',   'Mila',     'user',  false, 'Sharing updates and ideas.')
on conflict (id) do nothing;

insert into public.follows (follower_id, following_id) values
  ('user-knot', 'admin-1'),
  ('user-knot', 'admin-2'),
  ('admin-1',   'user-mila'),
  ('admin-2',   'admin-1'),
  ('user-mila', 'user-knot'),
  ('user-mila', 'admin-1')
on conflict do nothing;

insert into public.posts (id, user_id, content, created_at) values
  ('post-1', 'user-knot', 'Welcome to Knot Social. Search for @knot to view the owner profile. #launch', '2026-07-31T09:00:00.000Z'),
  ('post-2', 'user-mila', 'The web version is live and ready for posting. #web', '2026-07-31T10:15:00.000Z')
on conflict (id) do nothing;

insert into public.comments (id, post_id, user_id, text, created_at) values
  ('comment-1', 'post-1', 'user-mila', 'Love this update!', '2026-07-31T10:00:00.000Z')
on conflict (id) do nothing;

insert into public.direct_messages (id, sender_id, recipient_id, text, created_at) values
  ('dm-1', 'user-knot', 'user-mila', 'Welcome to direct messages.', '2026-07-31T11:00:00.000Z')
on conflict (id) do nothing;

insert into public.notifications (id, user_id, text, created_at) values
  ('note-1', 'user-mila', 'Knot mentioned you in the latest post.', '2026-07-31T10:30:00.000Z')
on conflict (id) do nothing;

insert into public.communities (id, name, description) values
  ('community-1', 'Creators',   'Share launches and feedback with creators.'),
  ('community-2', 'Developers', 'Discuss the latest web and mobile builds.')
on conflict (id) do nothing;

insert into public.community_members (community_id, user_id) values
  ('community-1', 'user-knot'),
  ('community-1', 'user-mila'),
  ('community-2', 'admin-1')
on conflict do nothing;
