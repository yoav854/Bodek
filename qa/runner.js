/* מריץ את QA_CASES מול check() של הדף, ועוד בדיקות מסך, אבטחה ושמירה. התוצאה נכתבת כ-JSON לאלמנט pre בשם qa-out.
   הרשת ל-Supabase חסומה כאן: שום בדיקה לא כותבת למסד הנתונים האמיתי. */
(async function(){
  const res = [];
  const ok = (area, name) => res.push({area, name, pass: true});
  const bad = (area, name, sev, problem, fix) => res.push({area, name, pass: false, sev, problem, fix});
  const posts = [];
  const realFetch = window.fetch;
  window.fetch = (u, o) => { if (String(u).includes('supabase.co')){ posts.push({u: String(u), body: o && o.body}); return Promise.resolve(new Response(null, {status: 204})); } return realFetch(u, o); };
  try {
    // 1. חישובים
    for (const c of window.QA_CASES){
      let r;
      try { r = check(c.slip, c.shifts, {profile: c.profile}); }
      catch (e){ bad('חישוב', c.name, 'קריטי', `check() קרס: ${e.message}`, 'לבדוק את המקרה הזה ב-check()'); continue; }
      const fails = [];
      for (const [title, status, amount] of c.expect){
        const got = r.checks.find(x => x.title === title);
        if (!got){ fails.push(`חסרה הבדיקה "${title}"`); continue; }
        if (got.status !== status) fails.push(`"${title}": צפוי ${status}, התקבל ${got.status}${got.amount ? ' ' + got.amount : ''}`);
        else if (amount != null && Math.abs((got.amount || 0) - amount) > 0.01) fails.push(`"${title}": צפוי ${amount} ₪, התקבל ${got.amount} ₪`);
      }
      fails.length ? bad('חישוב', c.name, 'קריטי', fails.join('; '), 'לתקן את החישוב ב-check()') : ok('חישוב', c.name);
    }

    // 2. מסך: בחירת תפקיד בכרטיס (בלי חלון קופץ), ובלי מדריך עמוס. ראש צוות פותח את שדות השכר, מאבטח סוגר אותם
    const roleLead = document.querySelector('input[name=role][value=lead]'), roleGuard = document.querySelector('input[name=role][value=guard]'), leadBox = document.getElementById('leadBox');
    if (!roleLead || !roleGuard || !leadBox) bad('מסך', 'בחירת תפקיד', 'גבוה', 'כרטיס התפקיד חסר', 'להחזיר את בחירת התפקיד בשלב 2');
    else {
      roleLead.checked = true; roleLead.dispatchEvent(new Event('change', {bubbles: true})); const opened = !leadBox.hidden;
      roleGuard.checked = true; roleGuard.dispatchEvent(new Event('change', {bubbles: true})); const closed = leadBox.hidden;
      (opened && closed && !document.getElementById('rolePick') && !document.getElementById('guideBox')) ? ok('מסך', 'בחירת תפקיד בכרטיס, בלי חלון קופץ') : bad('מסך', 'בחירת תפקיד', 'גבוה', `ראש צוות פותח שדות: ${opened}, מאבטח סוגר: ${closed}`, 'לבדוק את syncRole()');
    }

    // 3. מסך: חסימה כשחודש התלוש שונה מחודש הדיווח (החלטה 48)
    const s0 = window.QA_CASES[0].slip, cm = document.getElementById('calMonth'), go = document.getElementById('go'), err = document.getElementById('error'), out = document.getElementById('result');
    currentSlip = s0; go.disabled = false;
    cm.value = '2026-09'; out.innerHTML = ''; go.click();
    (!err.hidden && !out.innerText.trim()) ? ok('מסך', 'חודש לא תואם נחסם') : bad('מסך', 'חודש לא תואם נחסם', 'קריטי', 'בדיקה רצה כשהחודשים שונים', 'לבדוק את monthProblem() ב-go');
    const before = posts.length;
    cm.value = '2026-10'; go.click(); await new Promise(r => setTimeout(r, 300));
    (err.hidden && out.innerText.includes('תלוש')) ? ok('מסך', 'חודש תואם עובר') : bad('מסך', 'חודש תואם עובר', 'קריטי', 'בדיקה תקינה נחסמה', 'לבדוק את monthProblem()');

    // 4. שמירה: מה נשלח לסטטיסטיקה (בלי לשלוח באמת)
    const p = posts.slice(before).find(x => x.u.includes('record_check'));
    if (!p) bad('שמירה', 'רישום סטטיסטיקה', 'גבוה', 'בדיקה תקינה לא נשלחה לסטטיסטיקה', 'לבדוק את recordStats() אחרי go');
    else {
      const b = JSON.parse(p.body), probs = [];
      if (!/^[0-9a-f]{64}$/.test(b.p_fingerprint)) probs.push('טביעת אצבע לא תקינה');
      if (b.p_month !== '2026-10-01') probs.push('חודש שגוי: ' + b.p_month);
      if (typeof b.p_gap !== 'number' || b.p_gap < 0) probs.push('סכום לא תקין');
      const keys = Object.keys(b).sort().join(',');
      if (keys !== 'p_fingerprint,p_gap,p_has_gap,p_month') probs.push('נשלחים שדות נוספים: ' + keys);
      probs.length ? bad('שמירה', 'רישום סטטיסטיקה', 'קריטי', probs.join('; '), 'לתקן את recordStats()') : ok('שמירה', 'רישום סטטיסטיקה (רק 4 שדות, בלי פרטים)');
    }
    const fp1 = p && JSON.parse(p.body).p_fingerprint;
    // בדיקה חוזרת של אותו תלוש עם משמרות אחרות: אותה טביעת אצבע (החלטה 51)
    const counts0 = counts.morning; setCount('morning', 6); go.click(); await new Promise(r => setTimeout(r, 300)); setCount('morning', counts0);
    const p2 = posts.filter(x => x.u.includes('record_check')).pop();
    (p2 && JSON.parse(p2.body).p_fingerprint === fp1) ? ok('שמירה', 'בדיקה חוזרת מחליפה את הקודמת') : bad('שמירה', 'בדיקה חוזרת', 'גבוה', 'טביעת האצבע משתנה עם המשמרות, ובדיקות יספרו פעמיים', 'לבנות את טביעת האצבע מהתלוש בלבד');

    // 5. מסך: רשימה חופשית מחוץ לחודש, ויומן + רשימה עם חפיפה (החלטות 48-49)
    const fr = parseFreeText('1/9 בוקר\n2/10 בוקר', '2026-10');
    (fr.read.length === 1 && fr.unknown.length === 1) ? ok('מסך', 'תאריך מחוץ לחודש נדחה') : bad('מסך', 'תאריך מחוץ לחודש', 'בינוני', `נקראו ${fr.read.length}, נדחו ${fr.unknown.length}`, 'לבדוק את parseFreeText()');
    if (window.__showCalendar){
      const ev = (d, s, e) => ({summary: 'משמרת', start: {dateTime: `2026-10-${d}T${s}:00`}, end: {dateTime: `2026-10-${d}T${e}:00`}});
      window.__showCalendar([ev('04', '07:00', '15:00'), ev('05', '07:00', '15:00')], '2026-10');
      document.getElementById('freeText').value = '5/10 בוקר\n7/10 בוקר';
      document.getElementById('freeRun').click();
      counts.morning === 3 ? ok('מסך', 'יומן + רשימה, חפיפה נספרת פעם אחת') : bad('מסך', 'חפיפה יומן/רשימה', 'גבוה', `נספרו ${counts.morning} בקרים במקום 3`, 'לבדוק את applySources()');
    }

    // 5א. צהריים של שישי מהרשימה ומהיומן (שבת מ-16:00 כל השנה)
    const ff = parseFreeText('20/11 צהריים\n2 צהריים של שישי', '2026-11');
    ff.counts.friNoon === 3 ? ok('מסך', 'צהריים של שישי מהרשימה') : bad('מסך', 'צהריים של שישי מהרשימה', 'גבוה', `נקראו ${ff.counts.friNoon} במקום 3`, 'לבדוק את parseFreeText() ו-KIND_RE');
    const fc = classifyEvents([{summary: 'משמרת', start: {dateTime: '2026-07-03T15:00:00+03:00'}, end: {dateTime: '2026-07-03T23:00:00+03:00'}}], '2026-07', new Set())[0];
    (fc && fc.type === 'friNoon') ? ok('מסך', 'צהריים של שישי מהיומן') : bad('מסך', 'צהריים של שישי מהיומן', 'גבוה', `זוהה כ-${fc && fc.type}`, 'לבדוק את classifyEvents()');
    // 5ג. הערות: זמן נוסף. חובה תאריך ושעה, ומתחבר למשמרת הצמודה לפי היום
    const ex = [['5/11 15:00-15:45', 'morning', 45, false], ['עבדתי עוד 45 דק ב-12/11 מ-23:00', 'noon', 45, false], ['20/11 14:15-15:00', 'friNoon', 45, true],
      ['21/11 07:00-08:00', 'friNight', 60, false], ['עוד שעה וחצי עד 07:00 ב-22/11', 'morning', 90, true], ['14/11 23:00-23:30', 'shabbat', 30, false],
      ['12/11 15:00-15:45 חג', 'holiday', 45, false], ['11/11 23:00-23:30 ערב חג', 'friNoon', 30, false], ['13/11 07:00-08:00 מוצאי חג', 'motzash', 60, false], ['12/11 23:00-23:40 ערב החג', 'friNoon', 40, false]];
    const exBad = ex.filter(([t, type, mins, pre]) => { const r = parseExtras(t, '2026-11', 'guard'); const it = r.items[0]; return !it || it.type !== type || it.mins !== mins || it.pre !== pre; })
      .map(([t]) => { const it = parseExtras(t, '2026-11', 'guard').items[0]; return `"${t}"→${it ? it.type + ' ' + it.mins + (it.pre ? ' לפני' : '') : 'שגיאה'}`; });
    const exErr = ['עבדתי עוד 45 דק בתאריך 5/11', '5/11 10:00-11:00', '15:00-15:45', '5/10 15:00-15:45'].filter(t => parseExtras(t, '2026-11', 'guard').errs.length !== 1);
    (!exBad.length && !exErr.length) ? ok('מסך', 'הערות: זמן נוסף נקרא נכון, ושורה בלי שעה נדחית')
      : bad('מסך', 'הערות: זמן נוסף', 'גבוה', exBad.concat(exErr.map(t => `"${t}" לא נדחה`)).join('; '), 'לבדוק את parseExtras()');
    const xt = document.getElementById('extraText'), cm0 = cm.value;
    cm.value = '2026-11'; xt.value = '5/11 15:00-15:45'; xt.dispatchEvent(new Event('input'));
    const xo = currentShifts()._ovr.find(o => o.type === 'morning');
    (xo && xo.hours === 8.75 && !document.getElementById('extraMsg').hidden) ? ok('מסך', 'הערות נכנסות לחישוב (בוקר 8.75 שעות)')
      : bad('מסך', 'הערות לחישוב', 'גבוה', `התקבל ${JSON.stringify(xo)}`, 'לבדוק את extraOvr() ו-currentShifts()');
    window.__xss = 0; xt.value = '<img src=x onerror="window.__xss=1">5/11'; xt.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 200));
    window.__xss ? bad('אבטחה', 'XSS בהערות', 'קריטי', 'קוד מתיבת ההערות רץ בדף', 'להעביר כל טקסט דרך esc() ב-renderExtras()') : ok('אבטחה', 'XSS בהערות נחסם');
    xt.value = ''; xt.dispatchEvent(new Event('input')); cm.value = cm0;

    // 5ב. ערב שישי = שישי צהריים. חג = שבת: ערב חג בצהריים 1+7, הלילה שבו החג נכנס 8, ביום החג 8, מוצאי חג 5
    const fe = parseFreeText(['3 ערב שישי', 'ערב חג 1/10', 'מוצאי חג 2/10'].join('\n'), '2026-10');
    (fe.counts.friNoon === 4 && fe.counts.motzash === 1) ? ok('מסך', 'ערב שישי, ערב חג ומוצאי חג מהרשימה')
      : bad('מסך', 'ערב שישי וחג מהרשימה', 'גבוה', `שישי צהריים/ערב חג ${fe.counts.friNoon} (צפוי 4), מוצאי חג ${fe.counts.motzash} (צפוי 1)`, 'לבדוק את KIND_RE');
    const hv2 = (d1, h1, d2, h2) => ({summary: 'משמרת', start: {dateTime: `2026-09-${d1}T${h1}:00+03:00`}, end: {dateTime: `2026-09-${d2}T${h2}:00+03:00`}});
    const hc = classifyEvents([hv2('21', '15:00', '21', '23:00'), hv2('21', '23:00', '22', '07:00'), hv2('22', '07:00', '22', '15:00'), hv2('22', '23:00', '23', '07:00')], '2026-09', new Set(['2026-09-22'])).map(x => x.type).join(',');
    hc === 'friNoon,holiday,holiday,motzash' ? ok('מסך', 'חג כמו שבת ביומן') : bad('מסך', 'חג כמו שבת ביומן', 'גבוה', `התקבל ${hc}, צפוי friNoon,holiday,holiday,motzash`, 'לבדוק את classifyEvents()');

    // 6. אבטחה: טקסט זדוני בשורת תלוש לא רץ
    window.__xss = 0;
    const evil = JSON.parse(JSON.stringify(s0)); evil.lines[0].name = '<img src=x onerror="window.__xss=1">שכר יסוד'; evil.employer = '<script>window.__xss=1<\/script>';
    showResult(evil, {morning: 10}, false, {role: 'guard', vars: [{name: '<b onmouseover=x>שם</b>', unit: 1, qty: 1, line: ''}]});
    await new Promise(r => setTimeout(r, 200));
    window.__xss ? bad('אבטחה', 'XSS', 'קריטי', 'קוד מתוך התלוש רץ בדף', 'לעבור כל טקסט מהתלוש דרך esc()') : ok('אבטחה', 'XSS נחסם');

    // 7. עיגול התמיכה (החלטה 52): התאמת שאלות, מחיקת פרטים, מה נשלח, ו-XSS בהודעה
    const sb = window.__supportBot;
    if (!sb || !document.getElementById('sbOpen')) bad('תמיכה', 'עיגול התמיכה', 'גבוה', 'העיגול לא קיים בדף', 'להחזיר את supportBot()');
    else {
      const want = [['האם התלוש שלי נשמר?', 'privacy'], ['כמה הבראה מגיע', 'havraa'], ['אני רמ"ש 12 שעות', 'ramash'], ['למה הכפתור חסום', 'month'], ['איך מחושבות שעות נוספות בשבת', 'overtime'], ['מותר להוריד לי כסף על מטווח?', 'deduct'], ['שילמו לי 9% במקום שעות נוספות', 'nine'], ['מגיעה לי קרן השתלמות על שעות נוספות?', 'keren'], ['מה שכר המינימום בענף', 'minwage'], ['מה החוק אומר על נסיעות', 'travel'], ['כמה שעות מותר לעבוד ברצף', 'hours'], ['איך מגישים תלונה', 'gap'], ['מה הזכויות שלי', 'rights'], ['שישי צהריים כמה מגיע', 'overtime'], ['משמרת שישי 15:00', 'overtime'], ['משמרת צהריים בשישי', 'overtime'], ['כמה מקבלים בערב חג', 'overtime']];
      const miss = want.filter(([q, id]) => (sb.match(q) || {}).id !== id).map(([q, id]) => `"${q}"→${(sb.match(q) || {}).id || 'כלום'} (צפוי ${id})`);
      miss.length ? bad('תמיכה', 'התאמת שאלות', 'בינוני', miss.join('; '), 'לעדכן מילות מפתח ב-FAQ') : ok('תמיכה', 'התאמת שאלות');
      const s = sb.scrub('ת"ז 123456789, קיבלתי 4,350.20 ₪, מייל a.b@test.com, 8 שעות');
      (/\d{5}|4,350|@/.test(s) || !s.includes('8 שעות')) ? bad('תמיכה', 'מחיקת פרטים אישיים', 'קריטי', 'נשאר: ' + s, 'לתקן את scrub()') : ok('תמיכה', 'מחיקת פרטים אישיים לפני שליחה');
      const s2 = sb.scrub('שילמו 850 ולא 3200, תעריף 47.5, ב-5/10 עבדתי 8 שעות');
      (/850|3200|47\.5/.test(s2) || !s2.includes('5/10') || !s2.includes('8 שעות')) ? bad('תמיכה', 'מחיקת סכומים קצרים', 'בינוני', 'נשאר: ' + s2, 'לתקן את scrub(): כל מספר של 3 ספרות ומעלה') : ok('תמיכה', 'מחיקת סכומים קצרים, תאריך ושעות נשארים');
      const noMatch = [['מתי מגיע התלוש של החודש', 'month'], ['קיבלתי 1250 בונוס', 'overtime']].filter(([q, id]) => (sb.match(q) || {}).id === id).map(([q, id]) => `"${q}"→${id}`);
      noMatch.length ? bad('תמיכה', 'התאמה שגויה', 'בינוני', noMatch.join('; '), 'לבדוק את match(): מילה שלמה ומספר עומד לבד') : ok('תמיכה', 'אין התאמה לחלק ממילה או ממספר');
      const R = RULESETS[0], hv = sb.FAQ.find(f => f.id === 'havraa').a;
      hv.includes(fmt(R.havraaPerHour)) ? ok('תמיכה', 'תשובות מתאימות לכללי הבודק') : bad('תמיכה', 'תשובות', 'גבוה', 'תשובת ההבראה לא תואמת ל-RULESETS', 'לבנות את התשובה מ-RULESETS');
      const nb = posts.length;
      document.getElementById('sbOpen').click();
      document.getElementById('sbBug').click();
      document.getElementById('sbText').value = '<img src=x onerror="window.__xss=2">הכפתור לא עובד 0501234567';
      document.getElementById('sbForm').requestSubmit();
      await new Promise(r => setTimeout(r, 300));
      const fb = posts.slice(nb).find(x => x.u.includes('submit_feedback'));
      if (!fb) bad('תמיכה', 'שליחת דיווח', 'גבוה', 'דיווח תקלה לא נשלח', 'לבדוק את send() בעיגול');
      else {
        const b = JSON.parse(fb.body), pr = [];
        if (b.p_kind !== 'bug') pr.push('סוג ' + b.p_kind);
        if (/0501234567/.test(b.p_text)) pr.push('מספר טלפון נשלח');
        if (Object.keys(b).sort().join(',') !== 'p_faq,p_kind,p_screen,p_text') pr.push('שדות נוספים');
        pr.length ? bad('תמיכה', 'שליחת דיווח', 'קריטי', pr.join('; '), 'לתקן את send()') : ok('תמיכה', 'דיווח תקלה נשלח בלי פרטים מזהים');
      }
      window.__xss === 2 ? bad('אבטחה', 'XSS בעיגול', 'קריטי', 'קוד מהודעת המשתמש רץ', 'להעביר את ההודעה דרך esc()') : ok('אבטחה', 'XSS בעיגול נחסם');
      // תקציר: שתי שאלות בלי תשובה, הראשונה נשלחת כתקלה. בתקציר נשארת רק השנייה. פתיחה חוזרת שולחת רק את מה שחדש
      const ask = async q => { document.getElementById('sbText').value = q; document.getElementById('sbForm').requestSubmit(); await new Promise(r => setTimeout(r, 100)); };
      await ask('זברה סגולה אחת'); await ask('זברה סגולה שתיים');
      const btns = [...document.querySelectorAll('#sbLog button.linkish')]; btns[btns.length - 2].click(); await new Promise(r => setTimeout(r, 200));
      const ns = posts.length; document.getElementById('sbClose').click(); await new Promise(r => setTimeout(r, 200));
      const sum1 = posts.slice(ns).find(x => x.u.includes('submit_feedback') && JSON.parse(x.body).p_kind === 'summary');
      const t1 = sum1 ? JSON.parse(sum1.body).p_text : '';
      (t1.includes('שתיים') && !t1.includes('אחת')) ? ok('תמיכה', 'תקציר בלי השאלה שכבר נשלחה כתקלה') : bad('תמיכה', 'תקציר', 'בינוני', 'בתקציר: ' + (t1 || 'לא נשלח'), 'לבדוק את unanswered ב-onclick');
      document.getElementById('sbOpen').click(); await ask('זברה סגולה שלוש');
      const ns2 = posts.length; document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); await new Promise(r => setTimeout(r, 200));
      const sum2 = posts.slice(ns2).find(x => x.u.includes('submit_feedback') && JSON.parse(x.body).p_kind === 'summary');
      const t2 = sum2 ? JSON.parse(sum2.body).p_text : '';
      (document.getElementById('sbPanel').hidden && t2.includes('שלוש') && !t2.includes('שתיים')) ? ok('תמיכה', 'Esc סוגר, ותקציר שני שולח רק את החדש') : bad('תמיכה', 'תקציר שני / Esc', 'בינוני', `נסגר: ${document.getElementById('sbPanel').hidden}, בתקציר: ${t2 || 'לא נשלח'}`, 'לבדוק את sendSummary() ואת Esc');
    }

    // 8. אבטחה: אין סודות בקוד הדף
    const html = document.documentElement.outerHTML;
    // הדפוס בנוי מחלקים, כדי שהבדיקה לא תמצא את עצמה
    new RegExp([['service', 'role'].join('_'), ['sb', 'secret', ''].join('_'), ['GOCSPX', ''].join('-')].join('|')).test(html) ? bad('אבטחה', 'סודות בדף', 'קריטי', 'מפתח סודי מופיע בקוד הדף', 'להסיר מיד ולהחליף את המפתח') : ok('אבטחה', 'אין סודות בדף');
  } catch (e){ bad('כללי', 'הרצה', 'קריטי', 'חבילת הבדיקות קרסה: ' + e.message, 'לבדוק את הדף ואת runner.js'); }
  const pre = document.createElement('pre'); pre.id = 'qa-out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
  document.title = 'QA_DONE';
})();
