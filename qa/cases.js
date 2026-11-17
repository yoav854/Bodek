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

    // ---------- תוספות ----------
    {name: 'תוספת שלא שולמה', slip: slip([line('שכר יסוד', 80, 47), hv(80)]), shifts: {morning: 10},
      profile: {role: 'guard', vars: [{name: 'שיחות טלפון', unit: 40, qty: 3, line: ''}]}, expect: [['שיחות טלפון', 'gap', 120]]},
    {name: 'תוספת ששולמה', slip: slip([line('שכר יסוד', 80, 47), hv(80), line('מונית', 1, 120)]), shifts: {morning: 10},
      profile: {role: 'guard', vars: [{name: 'מונית', unit: 40, qty: 3, line: '2'}]}, expect: [['מונית', 'ok']]},
  ];
})();
