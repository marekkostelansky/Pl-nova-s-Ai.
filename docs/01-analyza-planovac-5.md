# Fáza 1 – Analýza Plánovača 5.0 (v47)

Predmet analýzy: `index.html` vo vetve `main` (commit `b7a6c15`), 5 472 riadkov, jeden súbor
(HTML + CSS + JavaScript), bez servera, údaje v `localStorage` prehliadača.

Odkazy v tvare `index.html:1578` smerujú na riadok pôvodného súboru.

> **Ako čítať kód:** aplikácia vznikala vo verziách v4 → v50 tak, že novšia verzia
> **prepíše** staršiu funkciu (`personAvailable=function(){…}` volajúca pôvodnú). Skutočne
> platná je vždy **posledná** definícia v súbore. V inventári nižšie je uvedená práve tá.

---

## 1. Dátový model (stav aplikácie)

Celý stav je jeden JSON objekt v `localStorage` pod kľúčom `planovac_5_0_clean_state_v1`
(téma zvlášť pod `planovac_theme`).

| Časť | Obsah | Poznámka |
|---|---|---|
| `month` | aktuálne zobrazený mesiac `RRRR-MM` | |
| `people[]` | `id, name, role, min, max, carry` | role: `patrol` (hliadka), `stala` (stála služba), `predskolak`, `helper` (pomocná sila) |
| `pairs[]` | stále dvojice `{a,b}` | |
| `forbidden[]` | zakázané dvojice `{a,b}` | |
| `forbiddenRoles[]` | skupinový zákaz `{personId, role}` | „nesmie s pomocnými silami / predškolákmi“ (v37) |
| `rules` | fond, oddych, 32 h, max po sebe, víkendy, bloky voľna, PN/DOV hodiny, časy a obsadenie služieb | |
| `plans[mesiac].cells["pid\|dátum"]` | `code, note, manual, locked, source, absenceId, carryCode, carryNote, carryLocked` | `source`: `auto`, `manual`, `absence`, `clear`, (starý `carryover`) |
| `absences[]` | `id, personId, type (PN/DOV/CHV), from, to` | |
| `overtime[mesiac]["pid\|dátum"][]` | nadčasy `code, note, …` | vedené mimo fondu (v31) |
| `backups[]` | max. 10 snímok na „Vrátiť späť“ | obsahujú `plans, people, pairs, forbidden, overtime` |
| `ui` | mierka plachty, posledná ručná služba, zobrazené stĺpce | |

**Zápis hodín:** všade sa používa tvar `h,mm` – čiarka oddeľuje **minúty**, nie desatiny.
`178,00` = 178 h 0 min, `5,26` = **5 h 26 min** (`parseHM`, `index.html:1518`).

---

## 2. Inventár plánovacích pravidiel (skutočne platné správanie)

### R1 – Kódy služieb a ich čas (`entryInterval`, `index.html:1546`; `normalizeCode`, `:1536`)
- Hliadka: `5-17`, `7-19`, `19-7`, `20-4`, `17-5`; stála: `S 7-19`, `S 19-7`; `A` (administratíva
  `adminStart–adminEnd`, predvolene 7:30–15:30); `V` voľno; `PN`, `DOV`, `CHV` neprítomnosti.
- Vlastný čas `H-H` alebo `H:MM-H:MM`, stála `S H-H`; nadčas s predponou `N` (v49).
- Ak koniec ≤ začiatok, služba končí nasledujúci deň. Úvodné nuly sa odstraňujú (`07-19` → `7-19`).
- Čas sa počíta v **miestnom čase PC** – pri zmene času trvá nočná 13 h (október) / 11 h (marec).

### R2 – Požadované obsadenie dňa (`reqsForDate`, `index.html:1568`)
| Služba | Typ | Predvolený počet |
|---|---|---|
| denná hliadka 1 `5-17` | hliadka | 2 |
| denná hliadka 2 `7-19` | hliadka | 2 |
| denná stála `S 7-19` | stála | 1 |
| nočná hliadka 1 `19-7` | hliadka | 2 |
| nočná hliadka 2: **Pi–So `17-5`**, inak (Po–Št + Ne) `20-4` | hliadka | 2 |
| nočná stála `S 19-7` | stála | 1 |

Služby s počtom 0 sa vynechajú. Sviatky sa osobitne neriešia (výslovne v UI).

### R3 – Role (`personAvailable`, `index.html:1579`)
- Hliadku obsadzuje `patrol` a `predskolak`; stálu iba `stala`.
- `helper` (pomocná sila) sa **nikdy neplánuje automaticky**; zadáva sa ručne. Nemá kontrolu
  fondu ani oddychu (`roleFunded`, `:1517`).

### R4 – Fond (`minutesOverlapMonth` `:1554`, `totalWorkMinutes` v28 `:2801`, `totalWithCarry` `:1562`)
- Do fondu mesiaca sa započíta časť služby, ktorá **padne do daného mesiaca** (orezanie na hranice
  mesiaca), plus prenesený úsek `carryCode`.
- `PN` a `DOV` = pevne `pnHours`/`dovHours` (predvolene 5:26) **za každý kalendárny deň** v mesiaci;
  `CHV` a `V` = 0.
- `Spolu = odpracované + prenos`; musí byť v intervale `min … max` osoby (predvolene 178:00–190:00).
- Nadčasy sa do fondu **nezapočítavajú** (R18).
- Uloženie pravidiel aj **každé generovanie** prepíše `min/max` všetkých osôb s fondom hodnotami z
  Pravidiel (`readRulesInputsV4(true)`, `:1917`, `:1936`) – pozri zistenie Z4.

### R5 – Prenos hodín do ďalšieho mesiaca (`newMonth` v28, `index.html:2883`)
- Pri „Vytvoriť nový mesiac“ so zaškrtnutím: `nový prenos = Spolu(starý mesiac) − min`.
  Pomocná sila dostane `+0,00`.
- Prenos je uložený **pri osobe** (`p.carry`), nie pri mesiaci – pozri Z3.

### R6 – Služba cez polnoc na konci mesiaca (`newMonth` v28, v29–v30 `:2927–3029`)
- Služba posledného dňa, ktorá končí po polnoci, sa v novom mesiaci zapíše na 1. deň ako
  **zamknutý prenesený úsek** `carryCode = "00-H"` (stála `S 00-H`).
- Starý mesiac započíta hodiny do polnoci, nový mesiac od polnoci (nič sa nestratí ani nezdvojí).
- Prenesený úsek sa nedá vymazať generátorom; do tej istej bunky možno pridať ďalšiu službu,
  ak sa časovo neprekrýva (v28). Staré exporty s `source:"carryover"` sa automaticky migrujú (v29).
- Kontroluje sa iba posledný deň starého mesiaca; nadčas cez polnoc sa neprenáša.

### R7 – Minimálny oddych (`passesRest`, `index.html:1577`; `effectiveMinRest` `:2160`)
- Medzi koncom jednej a začiatkom ďalšej služby osoby musí byť ≥ `minRest` h (predvolene 12,
  vynútené minimum 8). Počítajú sa riadne služby, prenesené úseky aj nadčasy.
- Kontrolujú sa iba intervaly **aktuálneho mesiaca** (+ prenesený úsek na 1. deň) – pozri Z1.

### R8 – Zákaz prekryvu (`passesRest`, validácia v13 `:2162`)
- Dve služby osoby sa nesmú časovo prekrývať (aj nadčas so službou).

### R9 – Pravidlo 32 hodín voľna (`passesRolling` `:1578`, `passesRollingAdvisorV44` `:3133`, `passesRollingFromIntervalsV49` `:5364`)

Presný význam podľa implementácie (všetky tri kópie sú logicky zhodné):

1. Platí len pre osoby s fondom (hliadka, stála, predškolák); pomocná sila je vyňatá.
2. Pre **každý kalendárny deň D** mesiaca, pre ktorý deň D+6 ešte patrí do toho istého mesiaca,
   sa vezme okno **[D 00:00, D+7 00:00)** = 168 hodín. Okná sa posúvajú po celých dňoch od polnoci.
3. Do okna sa zahrnú všetky pracovné intervaly osoby – riadne služby vrátane `A`, prenesený úsek
   z predchádzajúceho mesiaca a nadčasy – orezané na okno.
4. Zistí sa **najdlhší súvislý úsek bez služby** v okne (vrátane úseku od začiatku okna po prvú
   službu a od poslednej služby po koniec okna).
5. Ak je tento úsek kratší ako `rollingRest` (predvolene 32 h) → porušenie.
6. `PN`, `DOV`, `CHV` a `V` sa rátajú ako voľno.
7. **Okná, ktoré presahujú hranicu mesiaca, sa nekontrolujú** (napr. 28.10.–3.11.) – pozri Z2.

V generátore je pravidlo tvrdé, v Kontrole kritické, v Poradcovi tvrdé (od v44); pri ručnej úprave
sa **nezobrazí varovanie** (Z13).

### R10 – Max. služieb po sebe (`passesMaxConsecutive` `:1954`, `consecutiveViolations` `:2050`)
- Počet po sebe idúcich kalendárnych dní s pracovným kódom v bunke (vrátane `A`; deň len s
  preneseným úsekom a nadčas sa nerátajú) ≤ `maxConsec` (predvolene 4).
- Generátor sa pozerá 14 dní dozadu aj dopredu **cez hranicu mesiaca** (v50 `getCellAnyMonth`),
  Kontrola počíta sériu len v rámci mesiaca (Z15); Poradca to nekontroluje vôbec (Z10).

### R11 – Voľné víkendy (`freeWeekendCount`, `index.html:1607`)
- Víkend je voľný, ak sobota aj nedeľa (obe v mesiaci) majú `V/PN/DOV/CHV` alebo prázdnu bunku.
  Nočná z piatka končiaca v sobotu ráno sa za prácu v sobotu nepovažuje.
- Minimum `freeWeekends` (predvolene 1) → upozornenie (nie závažné).

### R12 – Blok voľna (`longestFreeBlock` `:1608`, v4 `:2067`)
- Najdlhší súvislý blok voľných dní v mesiaci ≥ `freeBlockMin` (2) → inak upozornenie;
  > `freeBlockMax + 3` (4+3) → upozornenie „Príliš dlhý blok voľna“. Neprítomnosti sa rátajú ako voľno.

### R13 – Neprítomnosti (`index.html:1878–1887`)
- `PN` a `DOV` platia **00:00–24:00** každého dňa rozsahu; žiadna služba (ani nočná z
  predchádzajúceho dňa) do nich nesmie zasahovať – pri každom vykreslení sa takéto služby
  **zmažú, aj ručné** (`removeAllWorkOverlappingHardAbsences`) – pozri Z6.
- `CHV` nie je „tvrdý“ interval: blokuje len vlastný deň (bunka je obsadená), nočná z
  predchádzajúceho dňa do CHV zasahovať môže.
- Neprítomnosť sa zapíše do buniek mesiaca ako zamknutá (`source:"absence"`); viacmesačný rozsah
  sa uplatní pri zobrazení ďalšieho mesiaca.

### R14 – Stále dvojice (v16 `:2513–2563`, v17 `:2686–2726`)
- Generátor: ak je stály parťák osoby dostupný na danú službu, osoba **nesmie** byť spárovaná s
  nikým iným (`v16CanUseDynamicPair`) – prakticky tvrdé pravidlo, ktoré povolí rozdelenie iba
  vtedy, keď parťák nemôže. Stála dvojica má navyše bonus −900 v skóre.
- Ručná úprava: pri zadaní hliadkovej služby sa parťák **automaticky pridá** na tú istú službu,
  ak má prázdnu bunku a nemá PN/DOV (`commitManualCellWithPartner`, `:2342`) – bez kontroly
  oddychu, 32 h a fondu parťáka (Z14).

### R15 – Zakázané dvojice (`isForbidden` v37, `index.html:4005`)
- Explicitné dvojice + skupinové zákazy (osoba × všetky pomocné sily / všetci predškoláci;
  platí aj pre ľudí, ktorým rolu priradíš neskôr).
- Generátor: tvrdé; Kontrola: závažné; Poradca: tvrdé (v50); ručná úprava: varovanie.

### R16 – Pomocná sila na hliadke (`validateAll`, `index.html:1609`)
- Ak je na hliadkovej službe pomocná sila, musí tam byť aj člen hliadky (`patrol`/`predskolak`) –
  inak závažný problém. Generátor pri jednom voľnom mieste doplní k pomocnej sile partnera
  (`fillService`, `:1597`).

### R17 – Ručné zásahy sú pevné (`clearAutoCells` v30, `index.html:2990`)
- Každá ručná úprava sa zamkne; generátor maže iba `auto` bunky. Neprítomnosti a prenesené úseky
  zostávajú vždy. „Vyčistiť bunku“ nastaví nezamknuté `V` (generátor ho môže znova obsadiť).

### R18 – Nadčasy (v31, `index.html:3068–3131`)
- Samostatná evidencia mimo fondu, viac nadčasov v jednej bunke. Pre oddych, prekryv a 32 h sa
  rátajú ako služba; do fondu nie. Súhrn ukazuje „Spolu odpracované = fond + nadčas“ (v49).
- Limit nadčasov neexistuje.

### R19 – Administratíva `A` (v4 `addAdministration`, `index.html:2032`)
- Iba ak je zapnuté „Automaticky plánovať A“: dopĺňa `A` v pracovné dni ľuďom pod minimom fondu,
  s kontrolou maxima, oddychu, 32 h a max po sebe.

### R20 – Ručná úprava: varovanie namiesto zákazu (`isManualWarningIssue` `:2181`, `applyManualCell` `:2364`)
- **Zakázané** (nedá sa uložiť): služba zasahujúca do PN/DOV, služba prekrývajúca prenesený úsek.
- **Varovanie s možnosťou potvrdiť**: fond nad limitom, krátky oddych, veľa služieb po sebe,
  zakázaná dvojica, prebytok na službe. (32 h sa nevaruje – Z13.)

### R21 – Mäkké kritériá generátora
Hodnotenie kandidáta (`v17AssignmentScore`, `index.html:2610`): vzdialenosť od minima fondu,
priemer skupiny, vyváženie denných/nočných, jednostrannosť za 14 dní, preferencia blokov 2–3
služieb, penalizácia osamotenej služby a dlhých sérií, víkendy, opakovanie tej istej dynamickej
dvojice, náhoda. Hodnotenie celého plánu (`planScore` v4 `:2089` + v16 `:2581` + v17 `:2745`):
každý problém 120 000, chyba obsadenia +350 000, odchýlky fondu, rozptyl fondu v skupine
(strop 35 000), vzory služba–voľno–služba (strop 60 000), opakovanie rovnakej štvorice na
druhej hliadke (strop 55 000).

Generovanie (`generatePlan` v13, `index.html:2426`): až 20 pokusov (min. 3, max. 3,5 s, koniec po 6
pokusoch bez zlepšenia), dni chronologicky, poradie služieb v dni náhodne, druhý priechod
dopĺňa diery, vyberie sa plán s najnižším skóre.

### R22 – Závažnosť problémov (`issueSeverity`, `index.html:1690`)
Závažné: chýba/prebytok obsadenia, fond mimo limitu, zakázaná dvojica, pomocná sila bez člena
hliadky, krátky oddych/prekryv, 32 h, veľa služieb po sebe. Upozornenie: voľný víkend, blok voľna.

### R23 – Kontrola kandidáta v Poradcovi (`candidateCheckV31`, `index.html:3187`)
Rola (pomocná sila **je** povolená na hliadku), neprítomnosť v bunke daného dňa, zakázaná
dvojica so spoluobsadením (v50), platný čas, prekryv, oddych pred/po, 32 h (v44), pri riadnej
službe maximum fondu (nad maximom len ako nadčas, v49). **Chýba**: max po sebe, PN/DOV interval
00–24 pre nočnú pred neprítomnosťou, pravidlo R16.

### R24 – Výmena služieb (`swapValidationV44` `:4857`, rýchla kontrola v49 `:5342`)
Obe strany prejdú `candidateCheckV31`; výmena sa povolí, ak sa počet závažných problémov celého
plánu nezvýši. Prenesené úseky ostávajú zachované.

### Kde sa ktoré pravidlo uplatňuje

| Pravidlo | Generátor | Kontrola | Ručná úprava | Poradca |
|---|---|---|---|---|
| Obsadenie (presný počet) | cieľ | závažné | varovanie pri prebytku | návrhy |
| Rola | tvrdé | R16 | – | tvrdé (pomocná sila povolená) |
| PN/DOV 00–24 | tvrdé | auto-mazanie | zakázané | **iba deň bunky** |
| Oddych / prekryv | tvrdé | závažné | varovanie | tvrdé |
| 32 h voľna | tvrdé | závažné | **bez varovania** | tvrdé |
| Max po sebe | tvrdé (cez mesiace) | závažné (len v mesiaci) | varovanie | **nekontroluje** |
| Fond max | tvrdé | závažné | varovanie | tvrdé (inak nadčas) |
| Fond min | skóre | závažné | – | návrh doplnenia |
| Zakázané dvojice | tvrdé | závažné | varovanie | tvrdé |
| Stále dvojice | takmer tvrdé | štatistika | auto-pridanie parťáka | – |
| Voľný víkend, bloky voľna | skóre | upozornenie | – | – |

---

## 3. Inventár funkcií (všetky musia zostať dostupné)

- **Plachta:** výber mesiaca, generovanie s priebehom, filtre ľudí podľa rolí, voliteľné stĺpce
  (Fond, Prenos, Spolu, Základný fond, Cieľ, Výstupný prenos, Nadčas), vyhľadávanie, mierka
  60–120 %, posuvník, farebná legenda, bodky obsadenia dňa, zámky, poznámky, dvojité kliknutie /
  dlhé podržanie = vloženie poslednej služby, klik na meno = detail, klik na dátum = obsadenie dňa.
- **Úprava bunky:** rýchle kódy, vlastný čas, nadčas `N …`, poznámka, vyčistenie, preradenie na
  inú osobu so zoznamom dostupných, vysvetlenie „prečo tu je táto služba“, mazanie nadčasov.
- **Hromadná úprava** s náhľadom a potvrdením (neprítomnosti sa neprepisujú),
  **Vymazať ručné služby** (celkovo / za osobu), **Rýchle vyplnenie mesiaca** pre pomocné sily.
- **Ľudia:** pridanie, úprava (meno, rola, fond od/do, prenos), mazanie, poradie ťahaním.
- **Dvojice:** stále dvojice so štatistikou (spolu / rozdelení), zakázané dvojice jednotlivo aj
  skupinovo.
- **PN/DOV/CHV:** zadanie rozsahu, zoznam, mazanie.
- **Pravidlá:** fond, oddych, 32 h, max po sebe, voľné víkendy, bloky voľna, PN/DOV hodiny, časy
  `A`, automatické `A`, obsadenie a časy služieb, kontrola zadaných hodnôt.
- **Súhrn:** tabuľka hodín (fond, prenos, nadčas, spolu odpracované, denné/nočné/víkendy), grafy,
  spravodlivosť za posledné 3 mesiace.
- **Kontrola:** zoznam problémov s filtrami, závažnosť, „Ukázať na plachte“, Navrhni opravy,
  Vrátiť späť.
- **Poradca (offline):** otázky v slovenčine s toleranciou preklepov, rýchle formuláre (výmena,
  náhrada, nadčas, doplnenie fondu, kontrola), výmena kliknutím na plachtu s farebným označením
  vhodných služieb, návrhy riešení chýbajúcich miest, štatistiky nadčasov, „prečo nemôže“,
  „dá sa dokončiť bez nadčasov“.
- **Export:** nový mesiac s prenosom, JSON súbor / textové pole (zdieľanie), import, Excel plánu
  a súhrnu, tlač A3 na šírku (šetrná farebná), uloženie, reset, svetlý/tmavý režim.

---

## 4. Overené chyby a riziká

Zistenia Z1–Z12 boli **overené spustením pôvodného kódu** na syntetických údajoch
(`docs/overenie/overenie-v47.js`, výsledok 12/12 potvrdených). Z13–Z27 vyplývajú priamo z kódu.

| # | Zistenie | Dopad | Závažnosť |
|---|---|---|---|
| Z1 | Oddych sa nekontroluje cez prelom mesiaca, ak služba posledného dňa skončí pred polnocou (7-19 dňa 31. a 5-17 dňa 1. = 10 h) | generátor vytvorí neplatný plán, Kontrola mlčí | **vysoká** |
| Z2 | Pravidlo 32 h sa nekontroluje v oknách cez prelom mesiaca | porušenie 32 h na prelome nikto nevidí | **vysoká** (treba potvrdiť výklad) |
| Z3 | Prenos hodín je pri osobe, nie pri mesiaci – po vytvorení nového mesiaca ukazuje starý mesiac nesprávne súčty (12:00 → −154:00) | chybné historické prehľady, riziko chybného prenosu pri opakovaní | **vysoká** |
| Z4 | Každé generovanie prepíše individuálny fond osoby (napr. skrátený úväzok) | tiché zmeny limitov | stredná |
| Z5 | „Navrhni opravy“ = pregenerovanie celého mesiaca (stovky zmien vrátane minulých dní) | nepoužiteľné počas mesiaca | **vysoká** |
| Z6 | Zadanie PN potichu zmaže nočnú službu deň pred PN – bez upozornenia, že vzniklo nepokryté miesto | diera v rozpise | **vysoká** |
| Z7 | Poradca ponúkne nočnú deň pred PN; po uložení ju vykreslenie zmaže | návrh „zmizne“ | stredná |
| Z8 | „Vrátiť späť“ po pridaní PN/DOV/CHV neodstráni záznam (zálohy neobsahujú neprítomnosti, pravidlá ani skupinové zákazy) | neúplné vrátenie | stredná |
| Z9 | Preneseným úsekom 00-7 je 1. deň pre generátor celý blokovaný (aj 19-7 s 12 h oddychom) | konzervatívne; možno zámer | nízka (potvrdiť) |
| Z10 | Poradca nekontroluje max. počet služieb po sebe | návrh v rozpore s pravidlom | stredná |
| Z11 | Výpočty závisia od časového pásma PC (zmena času: 13 h / 11 h) | rozdiel medzi PC; treba zladiť so SAP | nízka (potvrdiť) |
| Z12 | Dáta + 10 záloh v `localStorage` presiahnu limit (~5 mil. znakov) približne po 10–12 mesiacoch; `saveState` chybu neošetrí | **tichá strata uložených údajov** | **vysoká** |
| Z13 | Ručná úprava porušujúca 32 h nevyvolá varovanie | | stredná |
| Z14 | Auto-pridanie stáleho parťáka pri ručnej službe bez kontroly jeho oddychu/32 h/fondu | | stredná |
| Z15 | Kontrola max po sebe nevidí sériu z predchádzajúceho mesiaca (generátor áno) | nekonzistentné | nízka |
| Z16 | Export do Excelu neobsahuje nadčasy ani prenesené úseky | neúplný výstup | stredná |
| Z17 | Nový mesiac: opakované vytvorenie prepíše bunku 1. dňa a znova prepočíta prenos; nekontroluje, či ide o nasledujúci mesiac | | stredná |
| Z18 | Poradca povoľuje pomocnú silu ako kandidáta na hliadku bez kontroly R16 | | nízka |
| Z19 | Niektoré mená sa vkladajú do HTML bez ošetrenia (výber osôb, zoznam PN) – pri viacerých používateľoch riziko XSS | | stredná (pre 6.0) |
| Z20 | Kód je 40+ vrstiev prepisov; tri kópie pravidla 32 h; mŕtvy kód | ťažká údržba, riziko regresií | stredná |
| Z21 | Údaje sú len v jednom prehliadači; zdieľanie súborom JSON → rozchádzajúce sa verzie, žiadna história, audit ani súbežná práca | | **vysoká** (pre cieľ 6.0) |
| Z22 | Import JSON bez kontroly štruktúry | poškodený stav | stredná |
| Z23 | Sviatky sa neriešia | ručné zásahy | nízka (nová funkcia) |
| Z24 | PN je údaj o zdraví – v spoločnej aplikácii ho treba skryť pred neoprávnenými | GDPR | **vysoká** (pre 6.0) |

---

## 5. Neefektívne postupy z pohľadu plánovača

1. **Dvojité zadávanie** – plán sa prepisuje do SAP-u, každá zmena počas mesiaca sa zadáva dvakrát.
2. **PN počas mesiaca** – po zadaní PN aplikácia potichu zmaže aj nočnú pred PN; plánovač musí sám
   nájsť diery v Kontrole a riešiť každé miesto zvlášť v Poradcovi. Nevie, ktoré služby už niekto
   prevzal v SAP-e. Neexistuje globálne najlepšie riešenie pre všetky dotknuté služby naraz.
3. **„Navrhni opravy“ prestaví celý mesiac** – počas mesiaca nepoužiteľné; ochrana minulosti
   závisí od toho, či plánovač bunky ručne zamkol.
4. **Zdieľanie súborom** – kolegovia majú rôzne verzie, riaditeľ ani policajti nemajú aktuálny stav.
5. **Žiadne upozornenia** dotknutým policajtom, žiadna história „kto, kedy, čo zmenil“.
6. **Prenosy medzi mesiacmi** sú krehké (Z3, Z17) a cez prelom mesiaca chýbajú kontroly (Z1, Z2).

Tieto body sú priamym vstupom do návrhu v `02-navrh-planovac-6.md` a `03-sap-integracia.md`.
