/*
 * Overenie zistení z analýzy Plánovača 5.0 v47 (index.html).
 * Spúšťa PÔVODNÝ kód aplikácie v headless prehliadači (Playwright/Chromium)
 * na syntetických (fiktívnych) údajoch a overí každé podozrenie na chybu.
 *
 * Použitie:  node docs/overenie/overenie-v47.js
 * Požiadavka: npm balík "playwright" s prehliadačom Chromium.
 *
 * Skript index.html nemení – vytvorí si dočasnú kópiu, do ktorej iba sprístupní
 * vnútorné funkcie (window.__api), aby ich bolo možné volať z testu.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const SRC = path.resolve(__dirname, '../../index.html');
const MARKER = 'ensureV13Defaults();\n\ninitControls();attach();renderAll();applyTheme();setProgress(0,"Pripravené.");';
const EXPOSE = `window.__api={get state(){return state},set state(v){state=v},
validateAll:()=>validateAll(),personAvailable:(...a)=>personAvailable(...a),candidateCheck:(...a)=>candidateCheckV31(...a),
setCell:(...a)=>setCell(...a),getCell:(...a)=>getCell(...a),renderAll:()=>renderAll(),newMonth:()=>newMonth(),
totalWithCarry:(id)=>totalWithCarry(id),generatePlan:()=>generatePlan(),undo:()=>undo(),fmtHM:(m)=>fmtHM(m),
addAbsence:(pid,type,from,to)=>{$("absPerson").value=pid;$("absType").value=type;$("absFrom").value=from;$("absTo").value=to;addAbsence();},
minutesOverlapMonth:(d,c)=>minutesOverlapMonth(d,c),syncControls:()=>syncControls()};\n`;

async function main() {
  const src = fs.readFileSync(SRC, 'utf8');
  if (!src.includes(MARKER)) throw new Error('index.html sa zmenil – značka na sprístupnenie funkcií sa nenašla.');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'planovac-v47-')), 'app.html');
  fs.writeFileSync(tmp, src.replace(MARKER, EXPOSE + MARKER));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: 'Europe/Bratislava' });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto('file://' + tmp);

  const results = await page.evaluate(async () => {
    const A = window.__api, S = () => A.state, R = [];
    const ok = (id, popis, potvrdene, detail) => R.push({ id, popis, potvrdene, detail });
    const P = i => S().people[i].id, N = i => S().people[i].name;
    const fresh = m => { S().month = m; S().plans = {}; S().absences = []; S().overtime = {}; S().backups = []; S().people.forEach(p => p.carry = '+0,00'); A.syncControls(); };
    const put = (i, d, c) => A.setCell(P(i), d, { code: c, manual: true, locked: true, source: 'manual' });

    // Z1 – oddych cez prelom mesiaca
    fresh('2026-10'); put(0, '2026-10-31', '7-19');
    S().month = '2026-11'; A.syncControls();
    const av = A.personAvailable(P(0), '2026-11-01', '5-17', 'patrol');
    put(0, '2026-11-01', '5-17');
    const rest = A.validateAll().filter(i => i.where === N(0) && /oddych/i.test(i.title));
    ok('Z1', '7-19 dňa 31.10. a 5-17 dňa 1.11. (oddych iba 10 h) – generátor to povolí a Kontrola nehlási', av.ok && rest.length === 0, `personAvailable=${av.ok}, hlásení oddychu=${rest.length}`);

    // Z2 – pravidlo 32 h sa nekontroluje v okne cez prelom mesiaca
    fresh('2026-10');
    [['2026-10-28', '7-19'], ['2026-10-29', '19-7'], ['2026-10-31', '7-19']].forEach(([d, c]) => put(2, d, c));
    const oct = A.validateAll().filter(i => i.where === N(2) && i.title.includes('32')).length;
    S().month = '2026-11'; A.syncControls();
    [['2026-11-01', '19-7'], ['2026-11-03', '7-19']].forEach(([d, c]) => put(2, d, c));
    const nov = A.validateAll().filter(i => i.where === N(2) && i.title.includes('32')).length;
    ok('Z2', 'Okno 28.10.–3.11. bez 32 h voľna (najdlhšie voľno 24 h) – nehlási sa v októbri ani v novembri', oct === 0 && nov === 0, `hlásení október=${oct}, november=${nov}`);

    // Z3 – prenos hodín je uložený pri osobe, nie pri mesiaci
    fresh('2026-10'); put(0, '2026-10-01', '7-19');
    const before = A.fmtHM(A.totalWithCarry(P(0)));
    document.getElementById('newMonthSelect').value = '11'; document.getElementById('newYearInput').value = '2026';
    A.newMonth();
    S().month = '2026-10'; A.syncControls();
    const after = A.fmtHM(A.totalWithCarry(P(0)));
    ok('Z3', 'Po vytvorení nového mesiaca sa zmení súčet hodín v starom mesiaci (prenos je pri osobe)', before !== after, `október pred: ${before} h, október po: ${after} h, prenos osoby: ${S().people[0].carry}`);

    // Z4 – generovanie prepíše individuálny fond
    fresh('2026-07'); S().people[0].min = '120,00'; S().people[0].max = '130,00';
    await A.generatePlan();
    ok('Z4', 'Generovanie prepíše individuálne nastavený fond osoby hodnotami z Pravidiel', S().people[0].min !== '120,00', `min po generovaní=${S().people[0].min}, max=${S().people[0].max}`);

    // Z5 – „Navrhni opravy“ pregeneruje celý mesiac
    const snap = JSON.parse(JSON.stringify(S().plans['2026-07'].cells));
    await A.generatePlan();
    let changed = 0; const cur = S().plans['2026-07'].cells;
    for (const k of new Set([...Object.keys(snap), ...Object.keys(cur)])) if ((snap[k]?.code || 'V') !== (cur[k]?.code || 'V')) changed++;
    ok('Z5', 'Opätovné generovanie (tlačidlo „Navrhni opravy“) zmení stovky buniek, aj minulé', changed > 50, `zmenených buniek=${changed}`);

    // Z6 – nočná služba pred PN sa potichu vymaže
    fresh('2026-10'); put(0, '2026-10-09', '19-7');
    A.addAbsence(P(0), 'PN', '2026-10-10', '2026-10-20');
    ok('Z6', 'Nočná 19-7 deň pred začiatkom PN sa pri zadaní PN potichu vymaže (bez upozornenia na nepokryté miesto)', A.getCell(P(0), '2026-10-09') === null, `bunka 9.10. po zadaní PN=${JSON.stringify(A.getCell(P(0), '2026-10-09'))}`);

    // Z7 – Poradca ponúkne nočnú deň pred PN
    const cc = A.candidateCheck(P(0), '2026-10-09', '19-7', { overtime: false });
    ok('Z7', 'Poradca považuje 19-7 deň pred PN za platnú (po uložení ju vykreslenie zmaže)', cc.ok === true, `candidateCheck.ok=${cc.ok}`);

    // Z8 – Späť po zadaní PN neodstráni PN
    A.undo();
    ok('Z8', '„Vrátiť späť“ po pridaní PN/DOV/CHV neodstráni záznam neprítomnosti', S().absences.length === 1, `záznamov neprítomnosti po undo=${S().absences.length}`);

    // Z9 – prenos na 1. deň zablokuje celý deň pre generátor
    fresh('2026-10'); put(0, '2026-10-31', '19-7');
    document.getElementById('newMonthSelect').value = '11'; document.getElementById('newYearInput').value = '2026';
    A.newMonth();
    const d1 = A.personAvailable(P(0), '2026-11-01', '19-7', 'patrol');
    ok('Z9', 'Osoba s preneseným úsekom 00-7 nemôže dostať od generátora ani 19-7 v ten istý deň (oddych by bol 12 h)', d1.ok === false, `personAvailable=${JSON.stringify(d1)}`);

    // Z10 – Poradca nekontroluje max. počet služieb po sebe
    fresh('2026-10');
    // krátke služby A (7:30–15:30), aby nevznikol konflikt s oddychom ani s 32 h – testuje sa iba limit po sebe
    ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].forEach(d => put(4, d, 'A'));
    const c5 = A.candidateCheck(P(4), '2026-10-09', 'A', { overtime: false });
    const g5 = A.personAvailable(P(4), '2026-10-09', 'A', 'patrol');
    ok('Z10', 'Poradca ponúkne 5. službu po sebe (limit 4), generátor ju správne odmietne', c5.ok === true && g5.ok === false, `Poradca ok=${c5.ok}, generátor ok=${g5.ok} (${g5.reason})`);

    // Z11 – zmena času (DST): nočná služba sa počíta reálnymi hodinami
    S().month = '2026-10'; const dst1 = A.minutesOverlapMonth('2026-10-24', '19-7') / 60;
    S().month = '2027-03'; const dst2 = A.minutesOverlapMonth('2027-03-27', '19-7') / 60;
    ok('Z11', 'Nočná 19-7 cez zmenu času sa počíta 13 h (október) a 11 h (marec) – závisí od časového pásma PC', dst1 === 13 && dst2 === 11, `24.10.2026: ${dst1} h, 27.3.2027: ${dst2} h`);

    // Z12 – rast úložiska
    fresh('2026-07'); await A.generatePlan();
    const monthChars = JSON.stringify(S().plans['2026-07']).length;
    ok('Z12', 'Veľkosť dát: 12 mesiacov + 10 záloh presiahne limit localStorage (~5 mil. znakov)', monthChars * 12 * 11 > 5e6, `1 mesiac ≈ ${monthChars} znakov, odhad 12 mes. × 11 kópií ≈ ${monthChars * 132} znakov`);
    return R;
  });

  for (const r of results) console.log(`${r.potvrdene ? 'POTVRDENÉ' : 'NEPOTVRDENÉ'}  ${r.id}  ${r.popis}\n            ${r.detail}`);
  await browser.close();
  const failed = results.filter(r => !r.potvrdene).length;
  console.log(`\nPotvrdených zistení: ${results.length - failed}/${results.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
