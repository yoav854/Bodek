/* בדיקות לדף הפרטיות (privacy.html): הוא מסמך משפטי, ולכן הטקסט שלו נעול בטביעת אצבע. שינוי מכוון בטקסט = לעדכן את הקבוע TEXT_HASH כאן.
   בנוסף: בלי גלישה אופקית בטלפון, סמל אתר, קישור דילוג וקישור חזרה לכלי. התוצאה נכתבת כ-JSON לאלמנט pre בשם qa-out. */
(async function(){
  const res = [];
  const ok = (area, name) => res.push({area, name, pass: true});
  const bad = (area, name, sev, problem, fix) => res.push({area, name, pass: false, sev, problem, fix});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const TEXT_HASH = '4a0fe145';
  const frameOf = (w, h) => new Promise(res => {
    const html = '<!doctype html>' + document.documentElement.outerHTML.replace(/<script>(?:(?!<\/script>)[^])*?(?:qa-out|__qaErr)(?:(?!<\/script>)[^])*<\/script>/g, '');
    const f = document.createElement('iframe'); f.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;border:0`;
    f.srcdoc = html; f.onload = () => setTimeout(() => res(f), 700); document.body.appendChild(f);
  });
  try {
    // 1. הטקסט המשפטי לא השתנה
    const txt = [...document.querySelectorAll('.doc')].map(d => d.textContent).join(' ').replace(/\s+/g, ' ').trim();
    let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
    const hash = h.toString(16);
    hash === TEXT_HASH ? ok('מסך', 'הטקסט של מדיניות הפרטיות לא השתנה') : bad('מסך', 'טקסט מדיניות הפרטיות', 'קריטי', `טביעת האצבע ${hash} במקום ${TEXT_HASH}, אורך ${txt.length}`, 'אם השינוי מכוון, לעדכן את TEXT_HASH ב-qa/privacy-runner.js');

    // 2. מבנה: שני מסמכים (עברית ואנגלית), קישור חזרה לכלי, דילוג וסמל
    (document.querySelectorAll('.doc').length === 2 && document.querySelector('.doc a[href="check.html"]') && document.querySelector('a.skip[href="#main"]') && document.querySelector('main#main') && document.querySelector('link[rel=icon]'))
      ? ok('מסך', 'שני המסמכים, קישור חזרה לכלי, דילוג וסמל') : bad('מסך', 'מבנה דף הפרטיות', 'גבוה', 'חסר מסמך, קישור חזרה (check.html), דילוג או סמל', 'להחזיר אותם');

    // 3. אין גלישה אופקית בטלפון (הכתובת הארוכה בתוך code)
    const f = await frameOf(375, 800), ow = f.contentDocument.documentElement.scrollWidth; f.remove();
    ow <= 376 ? ok('מסך', 'אין גלישה אופקית ב-375 (הפרטיות)') : bad('מסך', 'גלישה אופקית בטלפון', 'גבוה', `רוחב התוכן ${ow} בחלון של 375`, 'overflow-wrap: anywhere על code');

    const errs = (window.__qaErr || []).filter(e => !/^resource failed/.test(e));
    errs.length ? bad('חישוב', 'שגיאות סקריפט', 'קריטי', errs.slice(0, 3).join(' | '), 'לתקן') : ok('חישוב', 'אין שגיאות סקריפט בדף הפרטיות');
  } catch (e) {
    bad('חישוב', 'חבילת דף הפרטיות', 'קריטי', 'קרסה: ' + e.message, 'לבדוק את qa/privacy-runner.js');
  }
  const pre = document.createElement('pre'); pre.id = 'qa-out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
})();
