-- Run this once in Supabase > SQL Editor.
create table if not exists public.jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.expenses (like public.jobs including all);
create table if not exists public.payslips (like public.jobs including all);
create table if not exists public.app_settings (like public.jobs including all);

alter table public.jobs enable row level security;
alter table public.expenses enable row level security;
alter table public.payslips enable row level security;
alter table public.app_settings enable row level security;

create policy "Users manage own jobs" on public.jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own payslips" on public.payslips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own app settings" on public.app_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
