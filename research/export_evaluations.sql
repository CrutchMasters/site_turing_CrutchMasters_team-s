-- Виготовлення таблиці оцінок для аналізу (research/analyze_real_data.py).
--
-- Як користуватись:
--   1. Supabase → SQL Editor → вставте цей запит → Run.
--   2. Унизу результату натисніть «Download CSV» і збережіть як evaluations.csv.
--   3. python analyze_real_data.py evaluations.csv
--
-- Імена не вивантажуються: турнір, команда, робота і суддя замінюються номерами (T1, W1, J1 …).
-- Враховуються лише оцінки, які бере до уваги й таблиця лідерів: без розбивки за критеріями
-- (старі записи) або заповнені за ВСІМА критеріями раунду.
--
-- Щоб взяти один турнір, замініть `where true` на `where t.id = '<uuid турніру>'`.

with crit as (
  select r.id as round_id,
         case when jsonb_typeof(r.criteria) = 'array' and jsonb_array_length(r.criteria) > 0
              then array(select e->>'key' from jsonb_array_elements(r.criteria) e)
              else array['backend_quality', 'database_structure', 'frontend_quality', 'must_have', 'no_bugs']
         end as keys
  from rounds r
),
ev as (
  select e.jury_id, e.submission_id, e.round_id, e.total_score,
         s.team_id, r.tournament_id, r.number as round_number
  from jury_evaluations e
  join submissions s on s.id = e.submission_id and not s.is_draft
  join rounds r      on r.id = e.round_id
  join crit c        on c.round_id = e.round_id
  join tournaments t on t.id = r.tournament_id
  where true
    and e.total_score is not null
    and (e.criteria_scores is null
         or not exists (select 1 from unnest(c.keys) k
                        where jsonb_typeof(e.criteria_scores -> k -> 'score') is distinct from 'number'))
)
select 'T' || dense_rank() over (order by tournament_id)   as tournament,
       round_number                                         as round,
       'W' || dense_rank() over (order by submission_id)    as work,
       'C' || dense_rank() over (order by team_id)          as team,
       'J' || dense_rank() over (order by jury_id)          as juror,
       total_score::float8                                  as score
from ev
order by tournament, round_number, work, juror;
