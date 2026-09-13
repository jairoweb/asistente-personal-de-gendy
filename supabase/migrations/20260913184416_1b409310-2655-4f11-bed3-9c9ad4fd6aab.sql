create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours')
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  has_image boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours')
);

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant all on public.ai_conversations to service_role;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;

create index if not exists ai_conversations_user_expiry_idx
  on public.ai_conversations(user_id, expires_at desc);
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);

create or replace function public.touch_ai_conversation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.ai_conversations
  set last_message_at = timezone('utc', now()),
      expires_at = timezone('utc', now()) + interval '24 hours'
  where id = new.conversation_id
    and user_id = new.user_id;
  return new;
end;
$$;

create or replace function public.validate_ai_message_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ai_conversations c
    where c.id = new.conversation_id and c.user_id = new.user_id
  ) then
    raise exception 'conversation_id does not belong to the authenticated user';
  end if;
  return new;
end;
$$;

drop trigger if exists ai_messages_validate_owner on public.ai_messages;
create trigger ai_messages_validate_owner
before insert or update on public.ai_messages
for each row execute function public.validate_ai_message_owner();

drop trigger if exists ai_messages_touch_conversation on public.ai_messages;
create trigger ai_messages_touch_conversation
after insert on public.ai_messages
for each row execute function public.touch_ai_conversation();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "Users manage their ai conversations" on public.ai_conversations;
create policy "Users manage their ai conversations"
on public.ai_conversations for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their ai messages" on public.ai_messages;
create policy "Users manage their ai messages"
on public.ai_messages for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);