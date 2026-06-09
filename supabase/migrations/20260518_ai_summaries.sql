-- Migration: ai_summaries table + pg_cron
create table if not exists public.ai_summaries (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  summary      text not null,
  generated_at timestamptz not null default now(),
  date         date not null default current_date,
  unique (type, date)
);
alter table public.ai_summaries enable row level security;
create policy "ai_summaries_public_read" on public.ai_summaries for select using (true);
create policy "ai_summaries_service_write" on public.ai_summaries for all using (auth.role() = 'service_role');

-- pg_cron: generate AI summaries every 6 hours
select cron.schedule(
  'ai-summary-job',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/ai-summary',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.anon_key')),
      body := '{"type":"daily"}'::jsonb
    );
  $$
);
