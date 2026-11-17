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

-- הקשחה (17.11.2026, אחרי הבדיקה המקיפה): האתר לא נוגע בטבלאות ישירות, רק דרך הפונקציות
revoke all on table public.checks from anon, authenticated;

-- record_check מקבל רק נתונים סבירים: טביעת אצבע של 64 תווים הקסדצימליים, חודש בין 2024 לחודש הבא, פער עד 20,000 ₪
create or replace function public.record_check(p_fingerprint text, p_month date, p_has_gap boolean, p_gap numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'bad fingerprint'; end if;
  if p_month < date '2024-01-01' or p_month > (date_trunc('month', now()) + interval '1 month')::date then raise exception 'bad month'; end if;
  if p_gap is null or p_gap < 0 or p_gap > 20000 then raise exception 'bad amount'; end if;
  insert into public.checks (fingerprint, payslip_month, has_gap, gap_amount)
  values (p_fingerprint, date_trunc('month', p_month)::date, p_has_gap and p_gap > 0, p_gap)
  on conflict (fingerprint) do update
    set has_gap = excluded.has_gap, gap_amount = excluded.gap_amount, updated_at = now();
end;
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

revoke all on public.monthly_stats from anon, authenticated;
-- admin_token ו-get_stats (הקוד הסודי) נוצרו ישירות ב-Supabase ולא נשמרים כאן, כי המאגר ציבורי

