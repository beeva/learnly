-- Item difficulty calibration. `difficulty` stays the value the engine uses; the
-- author's original estimate is kept so calibration can be bounded and audited.

alter table items
  add column authored_difficulty double precision,
  add column calibrated_at timestamptz,
  add column calibration_responses integer not null default 0;

update items set authored_difficulty = difficulty;

create function items_default_authored_difficulty() returns trigger
language plpgsql as $$
begin
  if new.authored_difficulty is null then
    new.authored_difficulty := new.difficulty;
  end if;
  return new;
end;
$$;

create trigger items_default_authored_difficulty
  before insert on items
  for each row execute function items_default_authored_difficulty();

-- Calibration reads every response to an item together with the learner's ability then.
create index attempts_item_answered_idx on attempts (item_id, answered_at);
