/* בדיקות לדף הכניסה (index.html): כותרת, קישורים, מעבר בין מסכים, כרטיס העדכונים (טקסט רגיל בלבד, "הבנתי" זוכר), ושאין שגיאות סקריפט.
   התוצאה נכתבת כ-JSON לאלמנט pre בשם qa-out, באותו מבנה של runner.js. */
(async function(){
  const res = [];
  const ok = (area, name) => res.push({area, name, pass: true});
  const bad = (area, name, sev, problem, fix) => res.push({area, name, pass: false, sev, problem, fix});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    // 1. הכותרת: המשפט שנבחר
    const h1 = document.getElementById('h1');
    (h1 && /התלוש\s+נשאר\s+בטלפון\s+שלך/.test(h1.textContent)) ? ok('מסך', 'הכותרת "התלוש נשאר בטלפון שלך"') : bad('מסך', 'הכותרת', 'גבוה', `הכותרת היא "${h1 && h1.textContent.trim()}"`, 'להחזיר את המשפט שיואב בחר בכותרת');

    // 2. קישורים: כל כפתור "בדוק את התלוש" לכלי, כל קישור פרטיות לדף הפרטיות, ואין קישור שבור
    const ctas = [...document.querySelectorAll('a.pill')];
    (ctas.length >= 2 && ctas.every(a => a.getAttribute('href') === 'check.html')) ? ok('מסך', 'כפתורי "בדוק את התלוש" מובילים לכלי') : bad('מסך', 'כפתורי הבדיקה', 'קריטי', `נמצאו ${ctas.length}, כתובות: ${ctas.map(a => a.getAttribute('href')).join(', ')}`, 'לכוון כל כפתור ל-check.html');
    const priv = [...document.querySelectorAll('a[href*="privacy"]')];
    (priv.length >= 2 && priv.every(a => a.getAttribute('href') === 'privacy.html')) ? ok('מסך', 'קישורי הפרטיות') : bad('מסך', 'קישורי הפרטיות', 'גבוה', `נמצאו ${priv.length}`, 'לכוון ל-privacy.html');
    const known = ['check.html', 'privacy.html', 'index.html'];
    const dead = [...document.querySelectorAll('a[href]')].filter(a => { const h = a.getAttribute('href'); return !known.includes(h) && !(h.startsWith('#') && document.getElementById(h.slice(1))); }).map(a => a.getAttribute('href'));
    dead.length ? bad('מסך', 'קישורים בדף הכניסה', 'גבוה', 'קישור לא מוכר: ' + dead.join(', '), 'להשאיר רק check.html, privacy.html, index.html וקישורי דילוג לאלמנט שקיים') : ok('מסך', 'אין קישור לא מוכר');

    // 3. מעבר בין מסכים בחשיפה עגולה ובחזרה
    const btn = n => document.querySelector(`.rb[data-view=${n}]`), on = n => document.getElementById('v-' + n).classList.contains('is-on');
    // השעון של הבדיקה לא מריץ אנימציות, לכן כאן בודקים את הלוגיקה בלי החשיפה העגולה (כמו מכשיר שביקש פחות תנועה).
    // את החשיפה עצמה בדקנו בדפדפן בזמן אמיתי: נפתחת, המסך מתחלף אחרי כחצי שנייה, ונסגרת תוך כשנייה.
    window.__qaReduce = true;
    btn('how').click(); await sleep(50);
    const toHow = on('how') && !on('home') && btn('how').classList.contains('is-on') && btn('how').getAttribute('aria-current') === 'page';
    btn('privacy').click(); await sleep(50);
    const toPriv = on('privacy') && !on('how') && !btn('how').hasAttribute('aria-current');
    btn('home').click(); await sleep(50);
    const back = on('home') && !on('privacy') && !document.getElementById('wipe').classList.contains('on');
    window.__qaReduce = false;
    (toHow && toPriv && back) ? ok('מסך', 'מעבר בין בית, איך זה עובד ופרטיות') : bad('מסך', 'מעבר בין מסכים', 'קריטי', `איך זה עובד: ${toHow}, פרטיות: ${toPriv}, חזרה: ${back}`, 'לבדוק את go() ו-show()');

    // 3ב. החשיפה העגולה נסגרת למרכז המסך ולא לנקודת הלחיצה (יואב, 22.11). השעון של הבדיקה לא מריץ אנימציות, לכן מחליפים את animate באחת מזויפת שמסיימת מיד ורושמת את התנועה.
    {
      const rec = [], realAnimate = Element.prototype.animate, centre = 'circle(0px at 50% 50%)';
      Element.prototype.animate = function(kf, o){ rec.push(kf); const f = {cancel(){}}; Object.defineProperty(f, 'onfinish', {set(fn){ setTimeout(fn, 0); }}); return f; };
      const closes = () => rec.filter(k => Array.isArray(k) && k.length === 2 && k[0].clipPath && k[1].clipPath && /150vmax/.test(k[0].clipPath));
      try {
        window.__qaReduce = false;
        btn('how').click(); await sleep(150);
        const viaRail = closes();
        const railOk = viaRail.length > 0 && viaRail[viaRail.length - 1][1].clipPath === centre;
        railOk ? ok('מסך', 'סמל בסרגל: החשיפה נסגרת למרכז המסך') : bad('מסך', 'סגירת החשיפה בסרגל', 'בינוני', 'החשיפה נסגרת לנקודת הלחיצה: ' + (viaRail.length ? viaRail[viaRail.length - 1][1].clipPath : 'לא נרשמה תנועה'), 'לסגור ל-circle(0px at 50% 50%) ב-go()');
        btn('home').click(); await sleep(150);
        const lg = document.querySelector('.logo');
        if (lg && /(^\/$|index\.html$)/.test(location.pathname)) {
          rec.length = 0; lg.click(); await sleep(700);
          const viaLogo = closes();
          const logoOk = viaLogo.length > 0 && viaLogo[viaLogo.length - 1][1].clipPath === centre;
          logoOk ? ok('מסך', 'הלוגו: החשיפה נסגרת למרכז המסך') : bad('מסך', 'סגירת החשיפה בלוגו', 'בינוני', 'החשיפה נסגרת לנקודת הלחיצה: ' + (viaLogo.length ? viaLogo[viaLogo.length - 1][1].clipPath : 'לא נרשמה תנועה'), 'לסגור ל-circle(0px at 50% 50%) ב-reveal() של הלוגו');
        }
      } finally { Element.prototype.animate = realAnimate; window.__qaReduce = false; await sleep(50); }
    }

    // 4. כרטיס העדכונים: בלי עדכון הוא מוסתר, ועדכון מוצג כטקסט רגיל
    await sleep(2500); // קודם מחכים שהבקשה האמיתית למסד הנתונים תחזור, כדי שלא תדרוס את העדכונים שהבדיקה מזינה
    const card = document.getElementById('notice');
    try { localStorage.removeItem('bodek_seen_notices'); } catch (e) {}
    window.__setNotices([]);
    card.hidden ? ok('מסך', 'בלי עדכון הכרטיס מוסתר') : bad('מסך', 'כרטיס עדכונים', 'גבוה', 'הכרטיס מוצג בלי עדכון', 'להסתיר כשהרשימה ריקה');
    window.__x = 0;
    window.__setNotices([{id: 1, body: '<img src=x onerror="window.__x=1">שכר המינימום עודכן', source: 'צו ההרחבה, <b>סעיף 9</b>', created_at: '2026-11-20T10:00:00Z'}, {id: 2, body: 'עדכון שני', source: 'כל זכות', created_at: '2026-11-19T10:00:00Z'}]);
    await sleep(200);
    const safe = !card.hidden && !card.querySelector('img') && !card.querySelector('b') && card.textContent.includes('<img') && !window.__x;
    safe ? ok('אבטחה', 'עדכון מוצג כטקסט רגיל (XSS נחסם)') : bad('אבטחה', 'XSS בכרטיס עדכונים', 'קריטי', 'קוד מתוך עדכון נכנס לדף', 'להציג עדכון רק דרך textContent');
    document.getElementById('nOk').click();
    const second = !card.hidden && card.textContent.includes('עדכון שני') && !card.textContent.includes('<img');
    document.getElementById('nOk').click();
    let stored = []; try { stored = JSON.parse(localStorage.getItem('bodek_seen_notices') || '[]'); } catch (e) {}
    (second && card.hidden && stored.includes(1) && stored.includes(2)) ? ok('מסך', '"הבנתי" מציג את העדכון הבא וזוכר') : bad('מסך', '"הבנתי"', 'גבוה', `העדכון השני הוצג: ${second}, הכרטיס נסגר: ${card.hidden}, נשמר: ${stored.join(',')}`, 'לבדוק את remember() ו-showNotice()');
    try { localStorage.removeItem('bodek_seen_notices'); } catch (e) {}

    // 5. כשאין כרטיס עדכונים, כרטיס הכותרת תופס את כל השורה
    const heroW = document.querySelector('.hero').getBoundingClientRect().width, bentoW = document.querySelector('#v-home .bento').getBoundingClientRect().width;
    window.__setNotices([]); await sleep(50);
    const wide = document.querySelector('.hero').getBoundingClientRect().width;
    (wide > bentoW * 0.95) ? ok('מסך', 'בלי עדכון כרטיס הכותרת ברוחב מלא') : bad('מסך', 'רוחב כרטיס הכותרת', 'בינוני', `רוחב ${Math.round(wide)} מתוך ${Math.round(bentoW)}`, 'לבדוק את .bento:has(.updates[hidden])');

    // 5ב. תיקוני סבב ה-QA: סרגל שנדבק, נגישות, וכרטיס עדכונים עם גוף ריק או ארוך
    const appCs = getComputedStyle(document.querySelector('.app'));
    appCs.overflow !== 'hidden' ? ok('מסך', 'אין overflow מוסתר על .app, הסרגל יכול להידבק') : bad('מסך', 'סרגל דביק', 'בינוני', 'ל-.app יש overflow: hidden', 'להסיר אותו');
    (document.querySelector('a.skip[href="#stage"]') && document.querySelector('.rail nav[aria-label]') && !document.querySelector('aside')) ? ok('מסך', 'קישור דילוג וניווט עם שם') : bad('מסך', 'נגישות הסרגל', 'בינוני', 'חסר קישור דילוג או שם לניווט', 'להחזיר skip ו-aria-label');
    window.__setNotices([{id: 9, body: '     ', source: 'x', created_at: '2026-11-20T10:00:00Z'}]); await sleep(50);
    document.getElementById('notice').hidden ? ok('מסך', 'עדכון עם גוף של רווחים לא מציג כרטיס') : bad('מסך', 'גוף ריק', 'בינוני', 'כרטיס ריק מוצג', 'לסנן body.trim()');
    window.__setNotices([{id: 10, body: 'א'.repeat(400), source: 'ב'.repeat(190), created_at: '2026-11-20T10:00:00Z'}]); await sleep(100);
    const nc = document.getElementById('notice');
    (!nc.hidden && nc.scrollWidth <= nc.clientWidth + 1) ? ok('מסך', 'גוף ארוך בלי רווחים לא גולש מהכרטיס') : bad('מסך', 'גוף ארוך', 'בינוני', `scrollWidth ${nc.scrollWidth} מול ${nc.clientWidth}`, 'overflow-wrap: anywhere');
    window.__setNotices([]);

const frameOf = (w, h) => new Promise(res => { // עותק של הדף בחלון בגודל נתון, בלי חבילת הבדיקות, כדי למדוד כמו מכשיר אמיתי
    const html = '<!doctype html>' + document.documentElement.outerHTML.replace(/<script>(?:(?!<\/script>)[^])*?(?:qa-out|__qaErr)(?:(?!<\/script>)[^])*<\/script>/g, '');
    const f = document.createElement('iframe'); f.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;border:0`;
    f.srcdoc = html; f.onload = () => setTimeout(() => res(f), 700); document.body.appendChild(f);
      });
    const fL = await frameOf(375, 800); fL.contentWindow.__setNotices([{id: 11, body: 'א'.repeat(400), source: 'https://example.com/' + 'ב'.repeat(300), created_at: '2026-11-20T10:00:00Z'}]); await sleep(200);
    const owL = fL.contentDocument.documentElement.scrollWidth; fL.remove();
    owL <= 376 ? ok('מסך', 'אין גלישה אופקית ב-375 (גם עם עדכון ארוך)') : bad('מסך', 'גלישה אופקית בטלפון', 'גבוה', `רוחב התוכן ${owL}`, 'overflow-wrap בכרטיס העדכונים');
    const fR = await frameOf(1440, 500); fR.contentWindow.scrollTo(0, 400); await sleep(250);
    const railTop = fR.contentDocument.querySelector('.rail').getBoundingClientRect().top; fR.remove();
    railTop >= 0 ? ok('מסך', 'הסרגל נדבק גם בחלון נמוך (500px)') : bad('מסך', 'סרגל בחלון נמוך', 'בינוני', `ראש הסרגל ${Math.round(railTop)} אחרי גלילה`, 'להקטין את min-height של הסרגל');
    document.querySelector('link[rel=icon]') ? ok('מסך', 'סמל אתר') : bad('מסך', 'סמל אתר', 'בינוני', 'חסר link rel=icon', 'להוסיף favicon');

    // 6. שגיאות סקריפט (לא כולל משאבים חיצוניים כמו גופנים)
    const errs = (window.__qaErr || []).filter(e => !/^resource failed/.test(e));
    errs.length ? bad('חישוב', 'שגיאות סקריפט', 'קריטי', errs.slice(0, 3).join(' | '), 'לתקן את השגיאה בדף') : ok('חישוב', 'אין שגיאות סקריפט בדף הכניסה');
  } catch (e) {
    bad('חישוב', 'חבילת דף הכניסה', 'קריטי', 'קרסה: ' + e.message, 'לבדוק את qa/landing-runner.js');
  }
  const pre = document.createElement('pre'); pre.id = 'qa-out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
})();
