/* בדיקות לדף הזכויות (rights.html): תוכן משפטי, ולכן הנתונים נעולים בטביעת אצבע (שינוי מכוון = לעדכן את הקבוע).
   בנוסף: מבנה הכרטיסים, מקורות, חיפוש (נרדפות, קידומות, ריק), סינון לפי נושא, קישור ישיר, בלי גלישה אופקית בטלפון, וקישורי ניווט.
   התוצאה נכתבת כ-JSON לאלמנט pre בשם qa-out, באותו מבנה של שאר הרצים. */
(async function(){
  const res = [];
  const ok = (area, name) => res.push({area, name, pass: true});
  const bad = (area, name, sev, problem, fix) => res.push({area, name, pass: false, sev, problem, fix});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DATA_HASH = '21df2eee';
  const frameOf = (w, h) => new Promise(res => {
    const html = '<!doctype html>' + document.documentElement.outerHTML.replace(/<script>(?:(?!<\/script>)[^])*?(?:qa-out|__qaErr)(?:(?!<\/script>)[^])*<\/script>/g, '');
    const f = document.createElement('iframe'); f.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;border:0`;
    f.srcdoc = html; f.onload = () => setTimeout(() => res(f), 900); document.body.appendChild(f);
  });
  const q = document.getElementById('q');
  const type = async v => { q.value = v; q.dispatchEvent(new Event('input', {bubbles: true})); await sleep(30); };
  const shown = () => [...document.querySelectorAll('.rc')].filter(c => !c.hidden).map(c => c.id);
  try {
    // 1. הנתונים לא השתנו בלי כוונה
    let h = 5381; const txt = JSON.stringify(RIGHTS); for (let i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
    const hash = h.toString(16);
    hash === DATA_HASH ? ok('מסך', 'נתוני הזכויות לא השתנו') : bad('מסך', 'נתוני הזכויות', 'קריטי', `טביעת האצבע ${hash}, ציפינו ל-${DATA_HASH}`, 'אם השינוי מכוון ומאושר, לעדכן את DATA_HASH ב-qa/rights-runner.js. נתון חדש נכנס רק עם מקור');

    // 2. מבנה: כל כרטיס עם כותרת, עובדות, מקור https מרשימה מותרת, נושא מוכר ומזהה ייחודי
    const cats = new Set(CATS.map(c => c[0])), ids = new Set(); const probs = [];
    const okHost = /^(?:www\.)?(?:kolzchut\.org\.il|gov\.il|btl\.gov\.il|chamber\.org\.il|he\.wikisource\.org|malam-payroll\.com)$/;
    for (const r of RIGHTS) {
      if (ids.has(r.id)) probs.push('מזהה כפול ' + r.id); ids.add(r.id);
      if (!r.title || !r.short || !r.facts.length) probs.push('חסר תוכן ב-' + r.id);
      if (!cats.has(r.cat)) probs.push('נושא לא מוכר ב-' + r.id);
      if (!r.src.length) probs.push('אין מקור ב-' + r.id);
      if (!['p', 'm', 's'].includes(r.v)) probs.push('חסרה תווית אימות ב-' + r.id);
      for (const s of r.src) { let u; try { u = new URL(s[1]); } catch (e) { probs.push('כתובת שבורה ב-' + r.id); continue; } if (u.protocol !== 'https:' || !okHost.test(u.hostname)) probs.push('מקור לא מאושר ב-' + r.id + ': ' + u.hostname); if (!s[2]) probs.push('חסר תאריך מקור ב-' + r.id); }
    }
    (RIGHTS.length >= 20 && !probs.length) ? ok('מסך', `${RIGHTS.length} כרטיסים, לכל אחד מקור מאושר ותאריך`) : bad('מסך', 'מבנה הכרטיסים', 'גבוה', `כרטיסים: ${RIGHTS.length}. ${probs.slice(0, 4).join('; ')}`, 'להשלים מקור, תאריך ונושא לכל כרטיס, ולהשתמש רק במקורות מרשימת המארחים');
    const nBadges = document.querySelectorAll('.rc .vb').length;
    nBadges === RIGHTS.length ? ok('מסך', 'בכל כרטיס תווית שאומרת מה אומת מול מקור רשמי') : bad('מסך', 'תוויות אימות', 'גבוה', `${nBadges} תוויות מתוך ${RIGHTS.length} כרטיסים`, 'להציג את VER[r.v] בכל כרטיס');
    const nCards = document.querySelectorAll('.rc').length;
    const links = [...document.querySelectorAll('.rc a[target=_blank]')];
    (nCards === RIGHTS.length && links.length > 0 && links.every(a => /noopener/.test(a.rel) && a.protocol === 'https:')) ? ok('מסך', 'כל כרטיס מוצג, וקישורי המקור נפתחים בלשונית חדשה בבטחה') : bad('מסך', 'הצגת הכרטיסים והקישורים', 'גבוה', `מוצגים ${nCards} מתוך ${RIGHTS.length}`, 'לבדוק את card() ואת rel="noopener"');

    // 3. חיפוש
    await type('שבת'); const s1 = shown();
    await type('הבראה'); const s2 = shown();
    await type('פוטרתי'); const s3 = shown();
    await type('בשבת'); const s4 = shown();
    await type('חופש'); const s5 = shown();
    await type('zzzqqq'); const s6 = shown(), emptyVisible = !document.getElementById('empty').hidden;
    await type('"הבראה"'); const s7 = shown();
    await type(''); const s8 = shown();
    const searchOk = s1[0] === 'shabbat' && s2[0] === 'havraa' && s3.includes('severance') && s3.includes('notice') && s4.includes('shabbat') && s5.includes('vacation') && s6.length === 0 && emptyVisible && s7[0] === 'havraa' && s8.length === RIGHTS.length;
    searchOk ? ok('מסך', 'חיפוש: מילה, נרדפות, קידומת, ריק וניקוי') : bad('מסך', 'חיפוש', 'גבוה', `שבת:${s1.slice(0, 2)} הבראה:${s2.slice(0, 2)} פוטרתי:${s3.slice(0, 3)} בשבת:${s4.slice(0, 2)} חופש:${s5.slice(0, 2)} שטות:${s6.length}/${emptyVisible} ניקוי:${s8.length}`, 'לבדוק את norm(), SYN ו-score() ב-rights-app');

    // 4. סינון לפי נושא, ושילוב עם חיפוש
    const chip = c => document.querySelector(`#cats .cat[data-c=${c}]`);
    chip('claim').click(); await sleep(30); const c1 = shown();
    await type('שכר'); const c2 = shown();
    await type(''); chip('all').click(); await sleep(30); const c3 = shown();
    const catOk = c1.length > 0 && c1.every(id => RIGHTS.find(r => r.id === id).cat === 'claim') && c2.every(id => RIGHTS.find(r => r.id === id).cat === 'claim') && c3.length === RIGHTS.length && chip('all').getAttribute('aria-pressed') === 'true';
    catOk ? ok('מסך', 'סינון לפי נושא, גם יחד עם חיפוש') : bad('מסך', 'סינון לפי נושא', 'גבוה', `נושא:${c1.length} עם חיפוש:${c2.length} הכל:${c3.length}`, 'לבדוק את apply() ואת הכפתורים ב-#cats');

    // 5. קישור ישיר לכרטיס
    location.hash = '#havraa'; await sleep(250);
    const hv = document.getElementById('havraa');
    (hv && !hv.hidden && hv.querySelector('details').open) ? ok('מסך', 'קישור ישיר לכרטיס פותח אותו') : bad('מסך', 'קישור ישיר', 'בינוני', 'הכרטיס לא נפתח אחרי #havraa', 'לבדוק את openHash()');
    history.replaceState(null, '', location.pathname);

    // 5ב. תרשים מדרגות המס התלת-ממדי: 6 עמודות בגובה עולה, אחוזים לפי הנתונים, מקרא, תיאור לקורא מסך, והעמודות "צמחו" אחרי הכניסה למסך
    const tx = document.querySelector('#tax .tx3d');
    if (tx) tx.classList.add('in'); await sleep(60);
    const cols = tx ? [...tx.querySelectorAll('.tx-col')] : [];
    const wantRates = RIGHTS.find(r => r.id === 'tax').bars.map(b => b[0] + '%').join(',');
    const heights = cols.map(c => parseFloat(getComputedStyle(c).height));
    const txOk = tx && cols.length === 6 && cols.map(c => c.querySelector('.f b').textContent).join(',') === wantRates && heights.every((h, i) => i === 0 || h > heights[i - 1])
      && cols.every(c => getComputedStyle(c).getPropertyValue('--s').trim() === '1') && document.querySelectorAll('#tax .tx-leg li').length === 6
      && tx.getAttribute('role') === 'img' && /47%/.test(tx.getAttribute('aria-label')) && !/מדרגות 2026/.test(document.querySelector('#tax .facts').textContent) && getComputedStyle(tx).overflow === 'hidden';
    txOk ? ok('מסך', 'תרשים המדרגות התלת-ממדי: 6 עמודות בגובה עולה, מקרא ותיאור') : bad('מסך', 'תרשים מדרגות המס', 'גבוה', `עמודות:${cols.length} אחוזים:${cols.map(c => c.querySelector('.f b') && c.querySelector('.f b').textContent).join(',')} גבהים:${heights.join('/')}`, 'לבדוק את viz3d() ואת ה-CSS של .tx-col');

    // 6. XSS: טקסט עם תגיות בחיפוש לא נכנס ל-DOM כ-HTML
    window.__xss = 0; await type('<img src=x onerror="window.__xss=1">'); await sleep(50);
    (window.__xss === 0 && !document.querySelector('#count img, #empty img, .rc img')) ? ok('אבטחה', 'חיפוש עם תגיות לא מריץ קוד') : bad('אבטחה', 'XSS בחיפוש', 'קריטי', 'קוד רץ מתוך שורת החיפוש', 'לא להכניס את הטקסט ל-innerHTML'); await type('');

    // 7. ניווט ודילוג וסמל
    (document.querySelector('.rb.is-on[href="rights.html"][aria-current="page"]') && document.querySelector('a.skip[href="#main"]') && document.querySelector('main#main') && document.querySelector('link[rel=icon]') && document.querySelector('label[for=q]'))
      ? ok('מסך', 'ניווט בסרגל, דילוג, סמל ותווית לשורת החיפוש') : bad('מסך', 'מבנה הדף', 'גבוה', 'חסר קישור פעיל בסרגל, דילוג, סמל או תווית לשדה', 'להחזיר');

    // 8. אין גלישה אופקית בטלפון
    const f = await frameOf(375, 800), ow = f.contentDocument.documentElement.scrollWidth; f.remove();
    ow <= 376 ? ok('מסך', 'אין גלישה אופקית ב-375 (הזכויות)') : bad('מסך', 'גלישה אופקית בטלפון', 'גבוה', `רוחב התוכן ${ow} בחלון של 375`, 'לבדוק עובדות ארוכות או כתובות');

    const errs = (window.__qaErr || []).filter(e => !/^resource failed/.test(e));
    errs.length ? bad('חישוב', 'שגיאות סקריפט', 'קריטי', errs.slice(0, 3).join(' | '), 'לתקן') : ok('חישוב', 'אין שגיאות סקריפט בדף הזכויות');
  } catch (e) {
    bad('חישוב', 'חבילת דף הזכויות', 'קריטי', 'קרסה: ' + e.message, 'לבדוק את qa/rights-runner.js');
  }
  const pre = document.createElement('pre'); pre.id = 'qa-out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
})();
