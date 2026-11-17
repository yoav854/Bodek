-- בודק התלושים: סטטיסטיקה אנונימית (החלטות 33-36)
-- שורה אחת לכל תלוש. בלי שם, בלי ת.ז., בלי התלוש עצמו.
-- מריצים פעם אחת ב-Supabase: SQL Editor -> New query -> Run

create table if not exists public.checks (
  fingerprint  text primary key,              -- טביעת אצבע של התלוש (SHA-256, נוצרת בטלפון). אותו תלוש נספר פעם אחת
  payslip_month date not null,                -- חודש התלוש (היום הראשון בחודש)
  has_gap      boolean not null,              -- נמצא פער לרעת העובד (בלי מס וביטוח לאומי)
  gap_amount   numeric(10,2) not null default 0, -- הכסף החסר שנמצא, ב-₪
  checked_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- אף אחד לא קורא או כותב לטבלה ישירות מהאתר
alter table public.checks enable row level security;

-- האתר רושם בדיקה רק דרך הפונקציה הזו. בדיקה חוזרת של אותו תלוש מעדכנת את השורה הקיימת
create or replace function public.record_check(p_fingerprint text, p_month date, p_has_gap boolean, p_gap numeric)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.checks (fingerprint, payslip_month, has_gap, gap_amount)
  values (
    left(p_fingerprint, 64),
    date_trunc('month', p_month)::date,
    p_has_gap,
    least(greatest(coalesce(p_gap, 0), 0), 100000)
  )
  on conflict (fingerprint) do update
    set has_gap = excluded.has_gap,
        gap_amount = excluded.gap_amount,
        updated_at = now();
$$;

revoke all on function public.record_check(text, date, boolean, numeric) from public;
grant execute on function public.record_check(text, date, boolean, numeric) to anon;

-- הסיכום לדף הפרטי של יואב, לפי חודש התלוש
create or replace view public.monthly_stats
with (security_invoker = true) as
select
  payslip_month,
  count(*)                                  as checks,
  count(*) filter (where has_gap)           as checks_with_gap,
  coalesce(sum(gap_amount), 0)              as missing_total
from public.checks
group by payslip_month
order by payslip_month;
