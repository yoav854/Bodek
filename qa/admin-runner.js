/* בדיקות לדף הניהול של העדכונים (admin.html). בלי קוד סודי אין שום שליחה למסד הנתונים האמיתי, והבדיקה לא כותבת אליו.
   התוצאה נכתבת כ-JSON לאלמנט pre בשם qa-out, באותו מבנה של runner.js. */
(async function(){
  const res = [];
  const ok = (area, name) => res.push({area, name, pass: true});
  const bad = (area, name, sev, problem, fix) => res.push({area, name, pass: false, sev, problem, fix});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    // 1. בלי קוד סודי רואים רק את הכניסה
    await sleep(300);
    (!document.getElementById('loginBox').hidden && document.getElementById('data').hidden) ? ok('אבטחה', 'בלי קוד סודי רואים רק את הכניסה') : bad('אבטחה', 'כניסה', 'קריטי', 'טופס העדכונים נחשף בלי קוד', 'להסתיר את #data עד כניסה מוצלחת');

    // 2. הדף לא נכנס לאינדקס של מנועי חיפוש
    const robots = document.querySelector('meta[name=robots]');
    (robots && /noindex/.test(robots.content)) ? ok('אבטחה', 'הדף מסומן noindex') : bad('אבטחה', 'noindex', 'גבוה', 'חסר סימון noindex', 'להחזיר את meta robots');

    // 3. בדיקת הטופס לפני שליחה: טקסט, מקור חובה, ואימות
    const v = window.__validate;
    const cases = [
      [['', 'צו 2022', true], false, 'עדכון ריק'], [['שכר המינימום עלה', '', true], false, 'בלי מקור'], [['שכר המינימום עלה', 'צו 2022', false], false, 'בלי סימון אימות'],
      [['x'.repeat(401), 'צו 2022', true], false, 'ארוך מדי'], [['שכר המינימום עלה', 'צו 2022', true], true, 'תקין']];
    const badCases = cases.filter(([a, expectOk]) => (v(...a) === '') !== expectOk).map(c => c[2]);
    badCases.length ? bad('חישוב', 'בדיקת הטופס', 'קריטי', 'לא תקין: ' + badCases.join(', '), 'לבדוק את validate()') : ok('חישוב', 'מקור חובה, אימות חובה ואורך מוגבל');

    // 4. הרשימה מוצגת כטקסט רגיל בלבד
    window.__x = 0;
    window.__renderNotices([{id: 7, body: '<img src=x onerror="window.__x=1">עדכון', source: '<b>מקור</b>', created_at: '2026-11-20T10:00:00Z', expires_at: '2026-12-20T10:00:00Z'}]);
    await sleep(150);
    const list = document.getElementById('list');
    (list.children.length === 1 && !list.querySelector('img') && !list.querySelector('b') && list.textContent.includes('<img') && !window.__x) ? ok('אבטחה', 'עדכון ברשימה מוצג כטקסט רגיל (XSS נחסם)') : bad('אבטחה', 'XSS ברשימה', 'קריטי', 'קוד מתוך עדכון נכנס לדף הניהול', 'להציג רק דרך textContent');
    window.__renderNotices([]);
    !document.getElementById('empty').hidden ? ok('מסך', 'בלי עדכון פעיל מוצגת הודעה') : bad('מסך', 'רשימה ריקה', 'בינוני', 'אין הודעה כשהרשימה ריקה', 'להציג את #empty');

const frameOf = (w, h) => new Promise(res => { // עותק של הדף בחלון בגודל נתון, בלי חבילת הבדיקות, כדי למדוד כמו מכשיר אמיתי
    const html = '<!doctype html>' + document.documentElement.outerHTML.replace(/<script>(?:(?!<\/script>)[^])*?(?:qa-out|__qaErr)(?:(?!<\/script>)[^])*<\/script>/g, '');
    const f = document.createElement('iframe'); f.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;border:0`;
    f.srcdoc = html; f.onload = () => setTimeout(() => res(f), 700); document.body.appendChild(f);
      });
    const fA = await frameOf(375, 800); fA.contentDocument.getElementById('data').hidden = false;
    fA.contentWindow.__renderNotices([{id: 3, body: 'עדכון', source: 'https://example.com/' + 'ב'.repeat(300), created_at: '2026-11-20T10:00:00Z', expires_at: '2026-12-20T10:00:00Z'}]); await sleep(200);
    const owA = fA.contentDocument.documentElement.scrollWidth; fA.remove();
    owA <= 376 ? ok('מסך', 'אין גלישה אופקית ב-375 (גם עם מקור ארוך)') : bad('מסך', 'גלישה אופקית בטלפון', 'גבוה', `רוחב התוכן ${owA}`, 'overflow-wrap ב-ul.list .m');
    document.querySelector('link[rel=icon]') ? ok('מסך', 'סמל אתר') : bad('מסך', 'סמל אתר', 'בינוני', 'חסר link rel=icon', 'להוסיף favicon');

    // 5. שגיאות סקריפט
    const errs = (window.__qaErr || []).filter(e => !/^resource failed/.test(e));
    errs.length ? bad('חישוב', 'שגיאות סקריפט', 'קריטי', errs.slice(0, 3).join(' | '), 'לתקן את השגיאה בדף') : ok('חישוב', 'אין שגיאות סקריפט בדף הניהול');
  } catch (e) {
    bad('חישוב', 'חבילת דף הניהול', 'קריטי', 'קרסה: ' + e.message, 'לבדוק את qa/admin-runner.js');
  }
  const pre = document.createElement('pre'); pre.id = 'qa-out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
})();
