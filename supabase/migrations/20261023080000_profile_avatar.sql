-- Profile pictures from the OAuth provider (Google sends `avatar_url` / `picture`).
-- Kept in sync on every sign-in, since GoTrue refreshes raw_user_meta_data then.

alter table public.profiles add column avatar_url text check (avatar_url ~ '^https://');

create function private.avatar_from_meta(p_meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when v ~ '^https://' then v end
  from (select coalesce(nullif(p_meta ->> 'avatar_url', ''), nullif(p_meta ->> 'picture', '')) as v) s;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    private.avatar_from_meta(new.raw_user_meta_data)
  );
  return new;
end;
$$;

create function private.handle_user_meta_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avatar text := private.avatar_from_meta(new.raw_user_meta_data);
begin
  if v_avatar is not null then
    update public.profiles set avatar_url = v_avatar where id = new.id and avatar_url is distinct from v_avatar;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_meta_updated
after update of raw_user_meta_data on auth.users
for each row execute function private.handle_user_meta_updated();

update public.profiles p
set avatar_url = private.avatar_from_meta(u.raw_user_meta_data)
from auth.users u
where u.id = p.id and private.avatar_from_meta(u.raw_user_meta_data) is not null;
