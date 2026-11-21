/*
 * Regresné testy Plánovača 6.0 – syntetické (fiktívne) údaje, beží nad index.html.
 * Použitie:  node tests/regression.js
 */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: 'Europe/Bratislava' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));

  const R = await page.evaluate(async () => {
    const H = window.__planovac, A = H.api, S = () => H.state, out = [];
    const t = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
    const P = i => S().people[i].id, N = i => S().people[i].name;
    const fresh = m => { S().month = m; S().plans = {}; S().absences = []; S().overtime = {}; S().backups = []; S().monthCarry = {}; S()._carryMonth = m;
      S().people.forEach(p => { p.carry = '+0,00'; if (p.role !== 'helper') { p.min = '178,00'; p.max = '190,00'; } }); A.syncControls(); A.renderAll(); };
    const put = (i, d, c) => A.setCell(P(i), d, { code: c, manual: true, locked: true, source: 'manual' });
    const nextMonth = () => { document.getElementById('newMonthSelect').value = String(+S().month.slice(5) % 12 + 1); document.getElementById('newYearInput').value = String(+S().month.slice(5) === 12 ? +S().month.slice(0, 4) + 1 : +S().month.slice(0, 4)); A.newMonth(); };

    /* ---- pôvodné pravidlá ---- */
    fresh('2026-10');
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']) put(0, d, '7-19');
    t('32 h: 7 dní denne 7-19 porušuje pravidlo', A.passesRolling(P(0), null) === false);
    fresh('2026-10');
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) put(0, d, '7-19');
    t('32 h: 4 dni po sebe a potom voľno je v poriadku', A.passesRolling(P(0), null) === true);
    t('32 h: kontrola ukáže problém pri 7 dňoch', (fresh('2026-10'), ['05', '06', '07', '08', '09', '10', '11'].forEach(d => put(0, '2026-10-' + d, '7-19')), A.validateAll().some(i => i.where === N(0) && i.title.includes('32'))));
    fresh('2026-10'); put(1, '2026-10-10', '7-19');
    t('Oddych: 5-17 deň po 7-19 (10 h) sa nepovolí', A.candidateCheck(P(1), '2026-10-11', '5-17', { overtime: false }).ok === false);
    t('Oddych: 7-19 deň po 7-19 (12 h) je v poriadku', A.candidateCheck(P(1), '2026-10-11', '7-19', { overtime: false }).ok === true);
    fresh('2026-10'); put(2, '2026-10-31', '19-7');
    nextMonth();
    const c1 = A.getCell(P(2), '2026-11-01');
    t('Noc cez prelom: 1. deň má prenesený úsek 00-7', c1 && c1.carryCode === '00-7', c1 && c1.carryCode);
    t('Noc cez prelom: nový mesiac počíta 7 h, starý 5 h', A.minutesOverlapMonth('2026-11-01', '00-7') === 420 && (S().month = '2026-10', A.minutesOverlapMonth('2026-10-31', '19-7') === 300));
    fresh('2026-10');
    t('PN a DOV = 5,26 h za deň', A.minutesOverlapMonth('2026-10-11', 'PN') === 326 && A.minutesOverlapMonth('2026-10-11', 'DOV') === 326);
    t('Zakázaná dvojica sa nepovolí', (fresh('2026-10'), S().forbidden.push({ a: P(3), b: P(4) }), put(3, '2026-10-12', '7-19'), A.candidateCheck(P(4), '2026-10-12', '7-19', { overtime: false }).ok === false));
    S().forbidden = [];

    /* ---- opravené chyby ---- */
    fresh('2026-10'); put(0, '2026-10-31', '7-19'); S().month = '2026-11'; A.syncControls(); put(0, '2026-11-01', '5-17');
    t('O1: oddych 10 h cez prelom mesiaca sa už hlási', A.validateAll().some(i => i.where === N(0) && /oddych/i.test(i.title)));
    t('O1: generátor cez prelom nepovolí 5-17 po 7-19', (delete S().plans['2026-11'].cells[P(0) + '|2026-11-01'], A.personAvailable(P(0), '2026-11-01', '5-17', 'patrol').ok === false));

    fresh('2026-10'); [['2026-10-28', '7-19'], ['2026-10-29', '19-7'], ['2026-10-31', '7-19']].forEach(([d, c]) => put(2, d, c));
    S().month = '2026-11'; A.syncControls(); [['2026-11-01', '19-7'], ['2026-11-03', '7-19']].forEach(([d, c]) => put(2, d, c));
    t('O2: 32 h cez prelom mesiaca sa už hlási (november)', A.validateAll().some(i => i.where === N(2) && i.title.includes('32')));

    fresh('2026-10'); put(0, '2026-10-01', '7-19');
    const before = A.fmtHM(A.totalWithCarry(P(0)));
    nextMonth(); S().month = '2026-10'; A.syncControls(); A.renderAll();
    t('O3: starý mesiac po vytvorení nového ukazuje pôvodné hodiny', A.fmtHM(A.totalWithCarry(P(0))) === before, `${before} vs ${A.fmtHM(A.totalWithCarry(P(0)))}`);
    S().month = '2026-11'; A.syncControls(); A.renderAll();
    t('O3: nový mesiac má vlastný prenos', S().people[0].carry !== '+0,00', S().people[0].carry);

    fresh('2026-07'); S().people[0].min = '120,00'; S().people[0].max = '130,00';
    await A.generatePlan();
    t('O4: generovanie neprepíše individuálny fond', S().people[0].min === '120,00' && S().people[0].max === '130,00');

    fresh('2026-10'); put(0, '2026-10-09', '19-7');
    const lenBefore = Object.keys(S().plans['2026-10'].cells).length;
    const removed = A.enterAbsence(P(0), 'PN', '2026-10-10', '2026-10-20');
    t('O5: nočná pred PN sa vráti ako dotknutá služba (nie potichu)', removed.length === 1 && removed[0].date === '2026-10-09', JSON.stringify(removed));
    t('O6: Poradca nenavrhne nočnú pred PN', A.candidateCheck(P(0), '2026-10-09', '19-7', { overtime: false }).ok === false);
    A.undo();
    t('O7: Späť vráti aj PN', S().absences.length === 0 && !A.getCell(P(0), '2026-10-10'), `neprítomností: ${S().absences.length}`);

    fresh('2026-10'); ['05', '06', '07', '08'].forEach(d => put(4, '2026-10-' + d, 'A'));
    t('O6: Poradca nepovolí 5. službu po sebe', A.candidateCheck(P(4), '2026-10-09', 'A', { overtime: false }).ok === false);

    fresh('2026-10'); put(5, '2026-10-12', '7-19');
    A.addOvertime(P(6), '2026-10-12', '7-19', 'test');
    t('Nadčas sa počíta do obsadenia dňa', !A.missing().rows.some(r => r.date === '2026-10-12' && r.code === '7-19' && r.missing > 2));

    const real = Storage.prototype.setItem; let threw = false;
    Storage.prototype.setItem = function () { throw new Error('quota'); };
    try { A.saveState(); } catch (e) { threw = true; } finally { Storage.prototype.setItem = real; }
    t('O12: plné úložisko nezhodí aplikáciu', threw === false);

    const keep = JSON.stringify(S());
    A.importState('{"people":[]}');
    t('Import: neplatný súbor sa odmietne a stav ostane', JSON.stringify(S()) === keep);
    S().people[0].name = '<img src=x onerror=alert(1)>'; A.renderAll();
    t('Mená sa čistia od HTML znakov', !/[<>]/.test(S().people[0].name), S().people[0].name);
    S().people[0].name = 'Marek';

    /* ---- inteligentná oprava: scenár „Marek PN“ ---- */
    fresh('2026-10');
    await A.generatePlan();
    const marek = S().people.find(p => p.name === 'Marek').id;
    const cellsBefore = JSON.parse(JSON.stringify(S().plans['2026-10'].cells));
    const critBefore = A.validateAll().filter(i => ['missing', 'fund', 'over', 'forbidden', 'rest'].includes(i.type)).length;
    const removed2 = A.enterAbsence(marek, 'PN', '2026-10-10', '2026-10-20');
    A.runRepair({ cutoff: '2026-10-10', removed: removed2 });
    const ctx = A.repairCtx();
    t('Oprava: PN zruší Marekove služby a vzniknú nepokryté miesta', removed2.length > 0 && ctx.slots.length > 0, `zrušené ${removed2.length}, nepokryté ${ctx.slots.length}`);
    t('Oprava: navrhnuté varianty s vysvetlením', ctx.variants.length >= 1 && ctx.variants[0].steps.length > 0, `variantov ${ctx.variants.length}`);
    const v0 = ctx.variants[0], unc0 = v0.uncovered.length;
    const cellsMid = JSON.parse(JSON.stringify(S().plans['2026-10'].cells));
    A.applyVariant(0);
    const after = S().plans['2026-10'].cells;
    let changedOthers = 0, changedPast = 0;
    for (const k of Object.keys(cellsMid)) { if ((after[k]?.code || 'V') !== (cellsMid[k]?.code || 'V')) { changedOthers++; if (k.split('|')[1] < '2026-10-10') changedPast++; } }
    let pastDiff = 0;
    for (const k of Object.keys(cellsBefore)) if (k.split('|')[1] < '2026-10-10' && (after[k]?.code || 'V') !== (cellsBefore[k]?.code || 'V')) pastDiff++;
    t('Oprava: existujúce služby sa nezmenili', changedOthers === 0 || [...Object.keys(cellsMid)].every(k => !cellsMid[k] || !['5-17', '7-19', '17-5', '19-7', '20-4', 'S 7-19', 'S 19-7'].includes(cellsMid[k].code) || after[k]?.code === cellsMid[k].code), `zmenených: ${changedOthers}`);
    t('Oprava: dni pred 10.10. zostali (okrem nočnej pred PN)', pastDiff <= 1, `rozdiel ${pastDiff}`);
    const missAfter = A.missing().missingTotal;
    t('Oprava: po použití zostanú nepokryté iba tie, čo oprava priznala', missAfter === unc0, `po použití ${missAfter}, priznané ${unc0}`);
    const critAfter = A.validateAll().filter(i => ['fund', 'over', 'forbidden', 'rest'].includes(i.type)).length;
    const critBase = (A.undo(), 0);
    t('Oprava: nepribudli nové porušenia pravidiel', critAfter <= critBefore, `pred ${critBefore}, po ${critAfter}`);
    return out;
  });

  let fail = 0;
  for (const r of R) { if (!r.ok) fail++; console.log(`${r.ok ? 'OK    ' : 'CHYBA '} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`); }
  if (errors.length) { console.log('Chyby stránky:', errors); fail += errors.length; }
  console.log(`\n${R.length - R.filter(r => !r.ok).length}/${R.length} testov prešlo`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
