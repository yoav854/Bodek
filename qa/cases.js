/* fake-payslips: תלושים פיקטיביים לבדיקת בודק התלוש. אף מספר כאן לא של אדם אמיתי.
   כל מקרה: slip (התלוש כמו ש-parsePayslip מחזיר), shifts (מונים), profile (הדרגה), expect (מה הבודק חייב להחזיר).
   expect: [כותרת הבדיקה, סטטוס, סכום] - סטטוס: ok / gap / info / skip. סכום רק כשהסטטוס gap.
   החישובים הצפויים לפי כללי 4/2026: מאבטח 47, רמ"ש 52, הבראה 1.64 לשעה, שעות נוספות לפי החלטות 43-47. */
(function(){
  const line = (name, qty, rate, amount) => ({name, qty, rate, amount: amount != null ? amount : Math.round(qty * rate * 100) / 100});
  const slip = (lines, extra = {}) => {
    const gross = Math.round(lines.reduce((a, l) => a + (l.amount || 0), 0) * 100) / 100;
    return Object.assign({employer: 'מעסיק פיקטיבי בע"מ', month: {ym: '2026-10', label: 'אוקטובר 2026'}, lines, funds: [], deductions: {},
      gross, net: gross, taxTotal: 0, fundTotal: 0, otherTotal: 0, creditPoints: null}, extra);
  };
  const guard = {role: 'guard', vars: []}, ramash = {role: 'ramash', vars: []};
  const hv = h => line('הבראה', h, 1.64);
  // קרן השתלמות (ידע-קרן-השתלמות.md): בסיס = שעות (עד 182) × 35.40 + ההבראה ששולמה. מעסיק 7.5%, עובד 2.5%.
  // 10 בקרים = 80 שעות: 80 × 35.40 + 131.20 = 2,963.20. מעסיק 222.24, עובד 74.08
  const kr = (base, er, ee) => ({funds: [{type: 'קרן השתלמות', base, employer: er, employee: ee}]});

  window.QA_CASES = [
    // ---------- מאבטח ----------
    {name: 'מאבטח תקין, 10 בקרים', slip: slip([line('שכר יסוד', 80, 47), hv(80)]), shifts: {morning: 10}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['תעריף לשעה', 'ok'], ['הבראה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'מאבטח, חסרה משמרת בתלוש', slip: slip([line('שכר יסוד', 72, 47), hv(80)]), shifts: {morning: 10}, profile: guard,
      expect: [['חסרות שעות', 'gap', 376]]},
    {name: 'מאבטח, תעריף 45 במקום 47', slip: slip([line('שכר יסוד', 80, 45), hv(80)]), shifts: {morning: 10}, profile: guard,
      expect: [['תעריף לשעה', 'gap', 160]]},
    {name: 'מאבטח, הבראה חסרה', slip: slip([line('שכר יסוד', 80, 47), line('הבראה', 80, 1.5, 120)]), shifts: {morning: 10}, profile: guard,
      expect: [['הבראה', 'gap', 11.2]]},
    {name: 'מאבטח, לילה עם שעה נוספת תקינה', slip: slip([line('שכר יסוד', 7, 47), line('שעות 125%', 1, 58.75), hv(8)]), shifts: {night: 1}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'מאבטח, שעה נוספת בתעריף נמוך', slip: slip([line('שכר יסוד', 7, 47), line('שעות 125%', 1, 56.25), hv(8)]), shifts: {night: 1}, profile: guard,
      expect: [['שעות נוספות', 'gap', 2.5]]},
    {name: 'מאבטח, שבת של 12 שעות (חריג)', slip: slip([line('שעות שבת 150%', 8, 70.5), line('שעות שבת 175%', 2, 82.25), line('שעות שבת 200%', 2, 94), hv(12)]),
      shifts: {shabbat: 1, _ovr: [{type: 'shabbat', n: 1, hours: 12}]}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok'], ['הבראה', 'ok']]},
    {name: 'מאבטח, בלי משמרות', slip: slip([line('שכר יסוד', 80, 47), hv(80)]), shifts: {}, profile: guard,
      expect: [['שעות עבודה', 'skip']]},

    // ---------- רמ"ש ----------
    {name: 'רמ"ש 12 שעות תקין', slip: slip([line('שכר יסוד', 120, 52), hv(120)]), shifts: {rDay: 10, _len: 12}, profile: ramash,
      expect: [['שעות עבודה', 'ok'], ['תעריף לשעה', 'ok'], ['הבראה', 'ok']]},
    {name: 'רמ"ש ששולם לו כמאבטח', slip: slip([line('שכר יסוד', 120, 47), hv(120)]), shifts: {rDay: 10, _len: 12}, profile: ramash,
      expect: [['תעריף לשעה', 'gap', 600]]},
    {name: 'רמ"ש 8 שעות + שישי', slip: slip([line('שכר יסוד', 96, 52), hv(96)]), shifts: {rDay: 10, rFri: 2, _len: 8}, profile: ramash,
      expect: [['שעות עבודה', 'ok'], ['תעריף לשעה', 'ok']]},
    {name: 'רמ"ש עם 2 משמרות מאבטח', slip: slip([line('שכר יסוד', 36, 52), line('שכר יסוד', 16, 47), hv(52)]), shifts: {rDay: 3, morning: 2, _len: 12}, profile: ramash,
      expect: [['שעות עבודה', 'ok'], ['תעריף לשעה', 'ok']]},

    // ---------- ראש צוות ----------
    {name: 'ראש צוות שעתי תקין', slip: slip([line('שכר יסוד', 80, 60), hv(80)]), shifts: {L_morning: 10},
      profile: {role: 'lead', payType: 'hourly', leadRate: 60, vars: []}, expect: [['תעריף לשעה', 'ok'], ['שעות עבודה', 'ok']]},
    {name: 'ראש צוות שעתי, שולם פחות', slip: slip([line('שכר יסוד', 80, 55), hv(80)]), shifts: {L_morning: 10},
      profile: {role: 'lead', payType: 'hourly', leadRate: 60, vars: []}, expect: [['תעריף לשעה', 'gap', 400]]},
    {name: 'ראש צוות בלי תעריף למשמרות מאבטח', slip: slip([line('שכר יסוד', 56, 55.71), hv(56)]), shifts: {L_morning: 5, morning: 2},
      profile: {role: 'lead', payType: 'hourly', leadRate: 60, vars: []}, expect: [['תעריף לשעה', 'skip']]},
    {name: 'ראש צוות גלובלי, חסר 200', slip: slip([line('משכורת', null, null, 8800), hv(160)]), shifts: {L_morning: 20},
      profile: {role: 'lead', payType: 'global', leadGlobal: 9000, leadLine: '0', leadHour: 0, vars: []},
      expect: [['שכר גלובלי', 'gap', 200], ['שעות עבודה', 'skip']]},

    // ---------- קרן השתלמות (אומת 17.11.2026) ----------
    {name: 'קרן תקינה', slip: slip([line('שכר יסוד', 80, 47), hv(80)], kr(2963.2, 222.24, 74.08)), shifts: {morning: 10}, profile: guard,
      expect: [['קרן השתלמות', 'ok']]},
    {name: 'קרן בלי ההבראה בבסיס', slip: slip([line('שכר יסוד', 80, 47), hv(80)], kr(2832, 212.4, 70.8)), shifts: {morning: 10}, profile: guard,
      expect: [['קרן השתלמות', 'gap', 9.84]]},
    {name: 'קרן חסרה בחודש הראשון (ברשף מהיום הראשון)', slip: slip([line('שכר יסוד', 80, 47), hv(80)], {seniorityMonths: 0}), shifts: {morning: 10}, profile: guard,
      expect: [['קרן השתלמות', 'gap', 222.24]]},
    {name: 'קרן, ניכוי עודף מהעובד', slip: slip([line('שכר יסוד', 80, 47), hv(80)], kr(2963.2, 222.24, 100)), shifts: {morning: 10}, profile: guard,
      expect: [['קרן השתלמות', 'ok'], ['קרן השתלמות - ניכוי ממך', 'gap', 25.92]]},
    {name: 'קרן, הפקדה רטרואקטיבית על 3 חודשים', slip: slip([line('שכר יסוד', 80, 47), hv(80)], kr(8889.6, 666.72, 222.24)), shifts: {morning: 10}, profile: guard,
      expect: [['קרן השתלמות', 'ok']]},
    // 200 שעות: התקרה 182. 182 × 35.40 + 298.48 = 6,741.28. מעסיק 505.60
    {name: 'קרן, תקרה של 182 שעות', slip: slip([line('שכר יסוד', 200, 47), hv(182)], kr(6741.28, 505.6, 168.53)), shifts: {morning: 25}, profile: guard,
      expect: [['קרן השתלמות', 'ok']]},
    // תוספת השבת לא נכנסת לבסיס: 80 שעות, אותו בסיס כמו 10 בקרים
    {name: 'קרן, משמרת שבת לא מגדילה את הבסיס', slip: slip([line('שכר יסוד', 72, 47), line('שעות שבת 150%', 8, 70.5), hv(80)], kr(2963.2, 222.24, 74.08)),
      shifts: {morning: 9, shabbat: 1}, profile: guard, expect: [['קרן השתלמות', 'ok']]},

    // ---------- פערים שגויים (סריקה 17.11.2026): מקרים שבעבר היו מקבלים פער שלא קיים ----------
    // משמרת בוקר של 12 שעות בשבוע של 5 ימים: 8.6 רגילות, 2 ב-125%, 1.4 ב-150%. לפי 6 ימים חסרים 14.10 ₪, ולכן "לשים לב" ולא פער
    {name: '12 שעות לפי שבוע של 5 ימים (8.6)', slip: slip([line('שכר יסוד', 8.6, 47), line('שעות 125%', 2, 58.75), line('שעות 150%', 1.4, 70.5), hv(12)]),
      shifts: {morning: 1, _ovr: [{type: 'morning', n: 1, hours: 12}]}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'info']]},
    {name: '12 שעות לפי שבוע של 6 ימים (8)', slip: slip([line('שכר יסוד', 8, 47), line('שעות 125%', 2, 58.75), line('שעות 150%', 2, 70.5), hv(12)]),
      shifts: {morning: 1, _ovr: [{type: 'morning', n: 1, hours: 12}]}, profile: guard, expect: [['שעות נוספות', 'ok']]},
    // בלי שום תוספת: חסר גם לפי הקריאה המקלה. 2 × 11.75 + 1.4 × 23.50 = 56.40
    {name: '12 שעות בלי תוספות', slip: slip([line('שכר יסוד', 12, 47), hv(12)]),
      shifts: {morning: 1, _ovr: [{type: 'morning', n: 1, hours: 12}]}, profile: guard, expect: [['שעות נוספות', 'gap', 56.4]]},
    // שבת ששולמה כשורת תוספת בלבד (50% ב-23.50), והשעות עצמן בשכר היסוד
    {name: 'שבת כשורת תוספת בלבד', slip: slip([line('שכר יסוד', 80, 47), line('תוספת שבת 50%', 8, 23.5), hv(80)]),
      shifts: {morning: 9, shabbat: 1}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    // הסכם 9%: 10 לילות, 80 שעות חול. 0.09 × 47 × 80 = 338.40, במקום תשלום על כל שעה נוספת
    {name: 'תוספת כוללת 9%', slip: slip([line('שכר יסוד', 80, 47), line('תוספת כוללת 9%', null, null, 338.4), hv(80)]),
      shifts: {night: 10}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    // שורת שבת בלי סימן אחוז בשם: השעות שלה חייבות להיספר
    {name: 'שורת "שעות שבת" בלי אחוז', slip: slip([line('שכר יסוד', 72, 47), line('שעות שבת', 8, 70.5), hv(80)]),
      shifts: {morning: 9, shabbat: 1}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'ראש צוות גלובלי בלי הבראה בחודש', slip: slip([line('משכורת', null, null, 9000)]), shifts: {L_morning: 20},
      profile: {role: 'lead', payType: 'global', leadGlobal: 9000, leadLine: '0', leadHour: 0, vars: []}, expect: [['הבראה', 'info']]},
    // 5 משמרות, נסיעות על 4 ימים: אולי שתי משמרות באותו יום. "לשים לב" ולא פער
    {name: 'נסיעות: 5 משמרות, 4 ימים', slip: slip([line('שכר יסוד', 40, 47), hv(40), line('נסיעות', null, null, 64), line('ימי עבודה', 4, null, 0)]),
      shifts: {morning: 5}, profile: guard, expect: [['נסיעות', 'info']]},
    // פנסיה על נסיעות: 5% מ-160 = 8 ₪. בלי שורה לנסיעות = פער
    {name: 'פנסיה: חסרה הפרשה על הנסיעות', slip: slip([line('שכר יסוד', 80, 47), hv(80), line('נסיעות', null, null, 160)],
      {funds: [{type: 'קצבה שכיר-תגמולים', base: 3891.2, employer: 291.84, employee: 272.38}, {type: 'קצבה שכיר-פיצויים', base: 3891.2, employer: 324.14, employee: 0}]}),
      shifts: {morning: 10}, profile: guard, expect: [['פנסיה ופיצויים', 'gap', 8]]},
    {name: 'פנסיה: הפרשה על הנסיעות תקינה', slip: slip([line('שכר יסוד', 80, 47), hv(80), line('נסיעות', null, null, 160)],
      {funds: [{type: 'קצבה שכיר-תגמולים', base: 3891.2, employer: 291.84, employee: 272.38}, {type: 'קצבה שכיר-פיצויים', base: 3891.2, employer: 324.14, employee: 0}, {type: 'קצבה שכיר-תגמולים', base: 160, employer: 8, employee: 8}]}),
      shifts: {morning: 10}, profile: guard, expect: [['פנסיה ופיצויים', 'ok']]},
    // כמו רשף בפועל: 40 שעות = 39 רגילות + 1 נוספת. הבראה וקרן על 39 בלבד: "לשים לב", לא פער (1,444.50 = 39 × 35.40 + 63.90)
    {name: 'הבראה וקרן על שעות רגילות בלבד (כמו רשף)', slip: slip([line('שכר יסוד', 39, 47), line('שעות 125%', 1, 58.75), line('הבראה', 39, 1.64, 63.9)], kr(1444.5, 108.34, 36.11)),
      shifts: {morning: 5}, profile: guard, expect: [['שעות עבודה', 'ok'], ['הבראה', 'info'], ['קרן השתלמות', 'info']]},

    // ---------- ממצאי site-qa על 62dbb64 (הוכחות T1-T16) ----------
    {name: 'T1 שעה נוספת בתעריף 40 (חסר בתוספת, לא בשעות)', slip: slip([line('שכר יסוד', 7, 47), line('שעות 125%', 1, 40), hv(8)]), shifts: {night: 1}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'gap', 18.75]]},
    {name: 'T1b שבת בתעריף 42', slip: slip([line('שכר יסוד', 72, 47), line('שעות שבת 150%', 8, 42), hv(80)]), shifts: {morning: 9, shabbat: 1}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'gap', 228]]},
    {name: 'T2 גלובלי עם תוספת שבת בלבד', slip: slip([line('משכורת', null, null, 9100), line('תוספת שבת 50%', 8, 25), hv(8)]), shifts: {L_shabbat: 1},
      profile: {role: 'lead', payType: 'global', leadGlobal: 9100, leadLine: '0', leadHour: 50, vars: []}, expect: [['שעות נוספות', 'ok']]},
    {name: 'T3 גלובלי עם הבראה חלקית', slip: slip([line('משכורת', null, null, 9000), line('הבראה', null, null, 100)]), shifts: {L_morning: 20},
      profile: {role: 'lead', payType: 'global', leadGlobal: 9000, leadLine: '0', leadHour: 0, vars: []}, expect: [['הבראה', 'info']]},
    {name: 'T3b גלובלי, קרן על 130 שעות', slip: slip([line('משכורת', null, null, 9000), line('הבראה', null, null, 262.4)], kr(4865.4, 364.9, 121.64)), shifts: {L_morning: 20},
      profile: {role: 'lead', payType: 'global', leadGlobal: 9000, leadLine: '0', leadHour: 0, vars: []}, expect: [['קרן השתלמות', 'info']]},
    {name: 'T4 בסיס קרן לא נקרא', slip: slip([line('שכר יסוד', 80, 47), hv(80)], kr(null, 222.24, 74.08)), shifts: {morning: 10}, profile: guard,
      expect: [['קרן השתלמות', 'ok']]},
    {name: 'T4b בסיס פנסיה לא נקרא', slip: slip([line('שכר יסוד', 80, 47), hv(80)], {funds: [{type: 'קצבה שכיר-תגמולים', base: null, employer: 291.84, employee: 272.38}]}), shifts: {morning: 10}, profile: guard,
      expect: [['פנסיה ופיצויים', 'ok']]},
    {name: 'T5 שתי שורות 9%', slip: slip([line('שכר יסוד', 80, 47), line('תוספת כוללת 9%', null, null, 169.2), line('תוספת כוללת 9% ראש צוות', null, null, 169.2), hv(80)]), shifts: {night: 10}, profile: guard,
      expect: [['שעות נוספות', 'ok']]},
    {name: 'T7b פנסיה על נסיעות בבסיס 150 במקום 160', slip: slip([line('שכר יסוד', 80, 47), hv(80), line('נסיעות', null, null, 160)],
      {funds: [{type: 'קצבה שכיר-תגמולים', base: 3891.2, employer: 291.84, employee: 272.38}, {type: 'קצבה שכיר-פיצויים', base: 3891.2, employer: 324.14, employee: 0}, {type: 'קצבה שכיר-תגמולים', base: 150, employer: 7.5, employee: 7.5}]}),
      shifts: {morning: 10}, profile: guard, expect: [['פנסיה ופיצויים', 'ok']]},
    {name: 'T8 שכר יסוד בלי תעריף, ותוספת שבת בלבד', slip: slip([line('שכר יסוד', 80, null, 3760), line('תוספת שבת 50%', 8, 23.5), hv(80)]), shifts: {morning: 9, shabbat: 1}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'T9 שורת שכר בשם אחר', slip: slip([line('שכר עבודה', 80, 47), hv(80)], kr(2963.2, 222.24, 74.08)), shifts: {morning: 10}, profile: guard,
      expect: [['שעות עבודה', 'skip'], ['הבראה', 'ok'], ['קרן השתלמות', 'ok']]},
    {name: 'T11 "תוספת כוללת למשמרת" אינה הסכם 9%', slip: slip([line('שכר יסוד', 80, 47), line('תוספת כוללת למשמרת', null, null, 50), hv(80)]), shifts: {morning: 10}, profile: guard,
      expect: [['שעות נוספות', 'ok']]},
    {name: 'T11b "תוספת ותק 9%" אינה הסכם 9%', slip: slip([line('שכר יסוד', 80, 47), line('תוספת ותק 9%', null, null, 100), hv(80)]), shifts: {morning: 10}, profile: guard,
      expect: [['שעות נוספות', 'ok']]},
    {name: 'T13 ראש צוות שעתי, 12 שעות לפי 8.6', slip: slip([line('שכר יסוד', 8.6, 60), line('שעות 125%', 2, 75), line('שעות 150%', 1.4, 90), hv(12)]),
      shifts: {L_morning: 1, _ovr: [{type: 'L_morning', n: 1, hours: 12}]}, profile: {role: 'lead', payType: 'hourly', leadRate: 60, vars: []}, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'info']]},
    {name: 'T14 לילה של 12 שעות', slip: slip([line('שכר יסוד', 7, 47), line('שעות 125%', 2, 58.75), line('שעות 150%', 3, 70.5), hv(12)]),
      shifts: {night: 1, _ovr: [{type: 'night', n: 1, hours: 12}]}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'T15 מוצ"ש של 8 שעות', slip: slip([line('שכר יסוד', 2, 47), line('שעות שבת 150%', 5, 70.5), line('שעות 125%', 1, 58.75), hv(8)]), shifts: {motzash: 1}, profile: guard,
      expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},

    // ---------- צהריים של שישי: שבת מ-16:00 כל השנה (צו 2022, סעיף 9) ----------
    {name: 'שישי צהריים: 1 רגילה, 7 שבת', slip: slip([line('שכר יסוד', 1, 47), line('שעות שבת 150%', 7, 70.5), hv(8)]),
      shifts: {friNoon: 1}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'שישי צהריים שולם לפי כניסת שבת בקיץ (4+4): חסרות 3 שעות שבת', slip: slip([line('שכר יסוד', 4, 47), line('שעות שבת 150%', 4, 70.5), hv(8)]),
      shifts: {friNoon: 1}, profile: guard, expect: [['שעות נוספות', 'gap', 70.5]]},
    {name: 'שישי צהריים 10 שעות: הנוספות בשבת ב-175%', slip: slip([line('שכר יסוד', 1, 47), line('שעות שבת 150%', 7, 70.5), line('שעות שבת 175%', 2, 82.25), hv(8)]),
      shifts: {friNoon: 1, _ovr: [{type: 'friNoon', n: 1, hours: 10}]}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'ראש צוות, שישי צהריים', slip: slip([line('שכר יסוד', 1, 60), line('שעות שבת 150%', 7, 90), hv(8)]),
      shifts: {L_friNoon: 1}, profile: {role: 'lead', payType: 'hourly', leadRate: 60, vars: []}, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},

    // ---------- הערות: זמן נוסף לפני תחילת משמרת (pre) ----------
    {name: 'שישי צהריים שהתחיל ב-14:15: 1.75 רגילות, 6.25 שבת, 0.75 ב-175%', slip: slip([line('שכר יסוד', 1.75, 47), line('שעות שבת 150%', 6.25, 70.5), line('שעות שבת 175%', 0.75, 82.25), hv(8)]),
      shifts: {friNoon: 1, _ovr: [{type: 'friNoon', n: 1, hours: 8.75, pre: 0.75}]}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},
    {name: 'בוקר + 45 דקות: 8 רגילות ו-0.75 ב-125%', slip: slip([line('שכר יסוד', 8, 47), line('שעות 125%', 0.75, 58.75), hv(8)]),
      shifts: {morning: 1, _ovr: [{type: 'morning', n: 1, hours: 8.75}]}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},

    {name: 'חג + 45 דקות: 8 שעות חג ו-0.75 ב-175%', slip: slip([line('שעות שבת 150%', 8, 70.5), line('שעות שבת 175%', 0.75, 82.25), hv(8)]),
      shifts: {holiday: 1, _ovr: [{type: 'holiday', n: 1, hours: 8.75}]}, profile: guard, expect: [['שעות עבודה', 'ok'], ['שעות נוספות', 'ok']]},

    // ---------- תוספות ----------
    {name: 'תוספת שלא שולמה', slip: slip([line('שכר יסוד', 80, 47), hv(80)]), shifts: {morning: 10},
      profile: {role: 'guard', vars: [{name: 'שיחות טלפון', unit: 40, qty: 3, line: ''}]}, expect: [['שיחות טלפון', 'gap', 120]]},
    {name: 'תוספת ששולמה', slip: slip([line('שכר יסוד', 80, 47), hv(80), line('מונית', 1, 120)]), shifts: {morning: 10},
      profile: {role: 'guard', vars: [{name: 'מונית', unit: 40, qty: 3, line: '2'}]}, expect: [['מונית', 'ok']]},
  ];
})();
