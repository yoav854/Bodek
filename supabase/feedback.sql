-- עיגול התמיכה (החלטה 52): דיווחי תקלות, שאלות בלי תשובה ותקציר שיחות.
-- האתר יכול רק להוסיף שורה דרך submit_feedback. קריאה וסימון "טופל" רק עם הקוד הסודי (טבלת admin_token, שלא נמצאת במאגר הציבורי).
-- הסוכן site-qa קורא את הדיווחים דרך get_feedback ומסמן אותם דרך mark_feedback (הסקיל support-bot).

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('bug', 'question', 'summary')),
  body        text not null default '' check (char_length(body) <= 1000),
  screen      text not null default '' check (char_length(screen) <= 120),
  faq         text[] not null default '{}',
  status      text not null default 'new' check (status in ('new', 'reproduced', 'not_reproduced', 'fixed', 'wontfix', 'faq_added')),
  qa_note     text,
  created_at  timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(p_kind text, p_text text, p_screen text, p_faq text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('bug', 'question', 'summary') then raise exception 'bad kind'; end if;
  if char_length(coalesce(p_text, '')) > 1000 or char_length(coalesce(p_screen, '')) > 120 then raise exception 'too long'; end if;
  if coalesce(array_length(p_faq, 1), 0) > 30 then raise exception 'too many'; end if;
  if exists (select 1 from unnest(coalesce(p_faq, '{}')) f where f !~ '^[a-z]{2,12}$') then raise exception 'bad faq'; end if;
  if p_kind = 'bug' and char_length(trim(coalesce(p_text, ''))) < 3 then raise exception 'empty'; end if;
  if p_kind = 'summary' and coalesce(array_length(p_faq, 1), 0) = 0 and char_length(trim(coalesce(p_text, ''))) = 0 then raise exception 'empty'; end if;
  -- הגנה בסיסית מהצפה: לא יותר מ-300 שורות בשעה מכל המשתמשים יחד
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 300 then raise exception 'rate'; end if;
  -- תקצירי שיחה נמחקים אחרי 180 יום (כמו במדיניות הפרטיות). המחיקה רצה עם כל הוספה
  delete from public.feedback where kind = 'summary' and created_at < now() - interval '180 days';
  insert into public.feedback(kind, body, screen, faq) values (p_kind, coalesce(p_text, ''), coalesce(p_screen, ''), coalesce(p_faq, '{}'));
end $$;
revoke all on function public.submit_feedback(text, text, text, text[]) from public;
grant execute on function public.submit_feedback(text, text, text, text[]) to anon;

create or replace function public.get_feedback(p_token text, p_status text default 'new')
returns setof public.feedback language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_token where token = p_token) then raise exception 'forbidden'; end if;
  return query select * from public.feedback where p_status = 'all' or status = p_status order by created_at;
end $$;
revoke all on function public.get_feedback(text, text) from public;
grant execute on function public.get_feedback(text, text) to anon;

create or replace function public.mark_feedback(p_token text, p_id bigint, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_token where token = p_token) then raise exception 'forbidden'; end if;
  update public.feedback set status = p_status, qa_note = left(p_note, 500) where id = p_id;
end $$;
revoke all on function public.mark_feedback(text, bigint, text, text) from public;
grant execute on function public.mark_feedback(text, bigint, text, text) to anon;
