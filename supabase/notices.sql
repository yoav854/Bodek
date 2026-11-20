-- תיבת העדכונים בדף הכניסה (החלטות 19-24): עדכון בתנאים או בשכר, עם תאריך, מקור וזמן תפוגה.
-- הקריאה פתוחה לכולם דרך get_notices (רק עדכונים שעוד לא פגו, עד 5, הכי חדש קודם).
-- הוספה, רשימה והסרה רק עם הקוד הסודי (טבלת admin_token, אותה אחת של דף הסטטיסטיקה), מדף הניהול admin.html.
-- להריץ פעם אחת ב-Supabase: SQL Editor, להדביק את כל הקובץ ולהריץ. אפשר להריץ שוב בלי נזק.

create table if not exists public.notices (
  id          bigint generated always as identity primary key,
  body        text not null check (char_length(btrim(body)) between 5 and 400),
  source      text not null check (char_length(btrim(source)) between 3 and 200),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
alter table public.notices enable row level security;
revoke all on public.notices from anon, authenticated;

-- קריאה ציבורית: רק מה שעוד בתוקף
create or replace function public.get_notices()
returns table (id bigint, body text, source text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select n.id, n.body, n.source, n.created_at
  from public.notices n
  where n.expires_at > now()
  order by n.created_at desc
  limit 5;
$$;
revoke all on function public.get_notices() from public;
grant execute on function public.get_notices() to anon;

-- הוספה (ברירת מחדל: 30 יום, מותר 1 עד 90)
create or replace function public.add_notice(p_token text, p_body text, p_source text, p_days int default 30)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if not exists (select 1 from public.admin_token where token = p_token) then raise exception 'forbidden'; end if;
  if p_days is null or p_days < 1 or p_days > 90 then raise exception 'bad days'; end if;
  insert into public.notices(body, source, expires_at)
  values (btrim(p_body), btrim(p_source), now() + make_interval(days => p_days))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.add_notice(text, text, text, int) from public;
grant execute on function public.add_notice(text, text, text, int) to anon;

-- הרשימה בדף הניהול: כל מה שעדיין בתוקף
create or replace function public.list_notices(p_token text)
returns setof public.notices language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_token where token = p_token) then raise exception 'forbidden'; end if;
  return query select * from public.notices where expires_at > now() order by created_at desc;
end $$;
revoke all on function public.list_notices(text) from public;
grant execute on function public.list_notices(text) to anon;

-- הסרה מוקדמת
create or replace function public.remove_notice(p_token text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_token where token = p_token) then raise exception 'forbidden'; end if;
  delete from public.notices where id = p_id;
end $$;
revoke all on function public.remove_notice(text, bigint) from public;
grant execute on function public.remove_notice(text, bigint) to anon;
