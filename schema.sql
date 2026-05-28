create table if not exists app_state (
  id text primary key,
  data text not null,
  updated_at text not null default (datetime('now'))
);
