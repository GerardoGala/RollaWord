-- Update 1 for the comments database. Run ONCE in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again.
--
-- What it does
--  1. Remembers which visitor wrote each comment (user_id), filled in by the database itself.
--  2. Only signed-in visitors (anonymous sign-in counts) may submit, so the security check
--     (Turnstile) on anonymous sign-in cannot be skipped.
--  3. Limits each visitor to 5 comments per 24 hours. Change the 5 below if you want.

alter table public.comments add column if not exists user_id uuid default auth.uid();

create or replace function public.limit_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and (
    select count(*) from public.comments
    where user_id = new.user_id and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Daily comment limit reached. Please try again tomorrow.';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_limit on public.comments;
create trigger comments_limit
  before insert on public.comments
  for each row execute function public.limit_comments();

revoke insert on public.comments from anon;

drop policy if exists "anyone can submit a pending comment" on public.comments;
drop policy if exists "signed-in visitors can submit a pending comment" on public.comments;
create policy "signed-in visitors can submit a pending comment"
  on public.comments for insert
  to authenticated
  with check (approved = false and user_id = auth.uid());
