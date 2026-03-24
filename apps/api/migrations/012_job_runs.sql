-- History of nightly job runs. The partial unique index guarantees at most one running
-- instance of a job across every API replica, without a separate lock service.

create table job_runs (
  id           bigserial primary key,
  job          text not null,
  started_at   timestamptz not null,
  finished_at  timestamptz,
  status       text not null check (status in ('running', 'succeeded', 'failed')),
  details      jsonb not null default '{}'
);

create unique index job_runs_one_running_key on job_runs (job) where status = 'running';
create index job_runs_job_started_idx on job_runs (job, started_at desc);
