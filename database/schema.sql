create table if not exists source_groups (
  id text primary key,
  telegram_id text unique not null,
  title text not null,
  username text,
  enabled boolean default true,
  storage_mode text default 'links' check (storage_mode in ('links', 'download', 'both')),
  created_at text default current_timestamp
);

create table if not exists media_items (
  id text primary key,
  telegram_message_id text not null,
  source_group_id text not null references source_groups(id),
  title text not null,
  type text not null check (type in ('book', 'manga', 'movie', 'series', 'anime', 'other')),
  author text,
  genre text default 'Non classé',
  language text default 'Inconnu',
  year integer,
  season integer,
  episode integer,
  format text,
  quality text,
  size_bytes bigint,
  storage_mode text default 'links' check (storage_mode in ('links', 'download', 'both')),
  file_path text,
  thumbnail_path text,
  thumbnail_status text default 'missing' check (thumbnail_status in ('missing', 'ready', 'failed')),
  telegram_url text,
  description text,
  tags text default '[]',
  status text default 'indexed' check (status in ('indexed', 'downloaded', 'needs-review')),
  posted_at text not null,
  created_at text default current_timestamp,
  updated_at text default current_timestamp,
  unique(source_group_id, telegram_message_id)
);

create index if not exists media_items_type_idx on media_items(type);
create index if not exists media_items_title_idx on media_items(title);
create index if not exists media_items_author_idx on media_items(author);
create index if not exists media_items_genre_idx on media_items(genre);
create index if not exists media_items_storage_mode_idx on media_items(storage_mode);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at text default current_timestamp
);

create table if not exists telegram_accounts (
  id text primary key default 'default',
  api_id integer not null,
  api_hash text not null,
  phone text not null,
  status text not null default 'code_required' check (status in ('not_configured', 'code_required', 'password_required', 'connected', 'failed', 'expired')),
  status_message text,
  session_path text default './storage/telegram/telegram-vault.session',
  session_string text,
  phone_code_hash text,
  code_requested_at text,
  last_checked_at text,
  created_at text default current_timestamp,
  updated_at text default current_timestamp
);

alter table telegram_accounts add column if not exists session_string text;
alter table telegram_accounts add column if not exists phone_code_hash text;
alter table telegram_accounts add column if not exists code_requested_at text;

alter table media_items add column if not exists thumbnail_path text;
alter table media_items add column if not exists thumbnail_status text default 'missing';

create table if not exists telegram_scraper_events (
  id bigserial primary key,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  event_type text not null,
  message text not null,
  source_group_id text references source_groups(id),
  created_at text default current_timestamp
);

create table if not exists telegram_backfill_jobs (
  id bigserial primary key,
  source_group_id text not null references source_groups(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  requested_limit integer not null default 100,
  processed_count integer not null default 0,
  imported_count integer not null default 0,
  error_message text,
  started_at text,
  finished_at text,
  created_at text default current_timestamp,
  updated_at text default current_timestamp
);

create index if not exists telegram_backfill_jobs_status_idx on telegram_backfill_jobs(status);
create index if not exists telegram_backfill_jobs_group_idx on telegram_backfill_jobs(source_group_id);

insert into app_settings(key, value) values ('default_storage_mode', 'links')
on conflict(key) do nothing;
