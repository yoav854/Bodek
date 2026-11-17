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

    // 2. מסך: בחירת תפקיד בכניסה
    const pick = document.getElementById('rolePick');
    if (!pick) bad('מסך', 'בחירת תפקיד', 'גבוה', 'מסך בחירת התפקיד לא קיים', 'להחזיר את #rolePick');
    else { pick.querySelector('[data-role=guard]').click(); document.getElementById('rolePick') ? bad('מסך', 'בחירת תפקיד', 'גבוה', 'המסך לא נסגר אחרי בחירה', 'לבדוק את rolePick()') : ok('מסך', 'בחירת תפקיד'); }

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
      const want = [['האם התלוש שלי נשמר?', 'privacy'], ['כמה הבראה מגיע', 'havraa'], ['אני רמ"ש 12 שעות', 'ramash'], ['למה הכפתור חסום', 'month'], ['איך מחושבות שעות נוספות בשבת', 'overtime']];
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
