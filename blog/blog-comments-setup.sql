-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Before running, replace the three example emails with your family's Gmail addresses.

-- 1. Comments table. Every new comment starts as NOT approved.
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_slug   text        not null check (char_length(post_slug)   between 1 and 200),
  author_name text        not null check (char_length(author_name) between 1 and 60),
  body        text        not null check (char_length(body)        between 1 and 2000),
  approved    boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- 2. Who may approve/delete. Only these emails (Google sign-in).
create table if not exists public.moderators (
  email text primary key
);
insert into public.moderators (email) values
  ('you@gmail.com'),
  ('wife@gmail.com'),
  ('son@gmail.com')
on conflict do nothing;

-- 3. Helper the approval page calls: "is the signed-in person a moderator?"
create or replace function public.is_moderator()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.moderators
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated;

-- 4. Security rules (Row Level Security)
alter table public.comments   enable row level security;
alter table public.moderators enable row level security;
-- (moderators has no policies on purpose: nobody can read or edit it through the API)

-- 4b. Table permissions for the API. Needed when "Grant API access to new tables
-- automatically" is left unchecked. Harmless if it is checked.
grant usage on schema public to anon, authenticated;
grant select, insert on public.comments to anon;
grant select, insert, update, delete on public.comments to authenticated;

drop policy if exists "anyone can submit a pending comment" on public.comments;
create policy "anyone can submit a pending comment"
  on public.comments for insert
  to anon, authenticated
  with check (approved = false);

drop policy if exists "public sees approved, moderators see all" on public.comments;
create policy "public sees approved, moderators see all"
  on public.comments for select
  to anon, authenticated
  using (approved = true or public.is_moderator());

drop policy if exists "moderators can approve" on public.comments;
create policy "moderators can approve"
  on public.comments for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

drop policy if exists "moderators can delete" on public.comments;
create policy "moderators can delete"
  on public.comments for delete
  to authenticated
  using (public.is_moderator());
