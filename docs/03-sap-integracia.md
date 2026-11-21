# Fáza 3 – Koniec dvojitého zadávania do SAP-u a Plánovača

## 1. Základná myšlienka

Dvojité zadávanie nevzniká preto, že chýba „tlačidlo na prenos“, ale preto, že **dva systémy
nevedia, čo vie ten druhý**. Riešenie preto stojí na troch pravidlách:

1. **Každá udalosť sa zadá iba raz.** Mesačný plán vzniká v Plánovači (je na to lepší).
   Zmeny počas mesiaca sa zadávajú tam, kde sú povinné – do SAP-u – a Plánovač si ich **prečíta**.
2. **Plánovač je inteligentná vrstva nad SAP-om.** Z prečítaných zmien sám zistí dopad, nájde
   nepokryté služby a navrhne riešenie (`02-navrh-planovac-6.md`, kap. 5).
3. **Priebežná kontrola zhody.** Po každom importe Plánovač ukáže *„Zhoda so SAP ✔“* alebo
   *„3 rozdiely“* s presným zoznamom. Tým zmizne riziko dvoch rôznych rozpisov – aj keď sa niečo
   ešte prepisuje ručne.

```mermaid
flowchart LR
  A["Plán v Plánovači<br/>(schválený)"] -->|jednorazovo: asistované zadanie / nahratie| S["SAP"]
  S -->|zmena počas mesiaca<br/>(PN, náhrada…)| S
  S -->|export / rozhranie| I["Import centrum<br/>kontrola · porovnanie"]
  I --> O["Režim opráv<br/>varianty"]
  O -->|schválenie| A
  O -->|zoznam zmien pre SAP| S
  I --> Z{"Zhoda so SAP?"}
```

---

## 2. Porovnanie možností

Hodnotenie 1–5, **5 = najlepšie pre nás** (pri „oprávneniach“, „vývoji“, „nákladoch“, „IT“ a
„zostávajúcej práci“ znamená 5 = najmenej náročné).

| Možnosť | Uskutočniteľnosť | Jednoduchosť | Spoľahlivosť | Oprávnenia | Bezpečnosť | Vývoj | Náklady | Potreba IT | Zostáva plánovačovi |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1. Import exportu zo SAP (Excel/CSV) | 5 | 4 | 4 | 4 | 5 | 4 | 5 | 4 | 3 – export a pretiahnutie súboru |
| 2. Vloženie tabuľky zo schránky (Ctrl+C / Ctrl+V) | 3 | 5 | 3 | 5 | 5 | 4 | 5 | 5 | 4 – dve skratky |
| 3. Sledovaný priečinok (Edge vie čítať zvolený priečinok) | 4 | 5 | 4 | 4 | 5 | 3 | 5 | 4 | 4 – len export v SAP-e |
| 4. Rozšírenie Edge „Odoslať do Plánovača“ (iba čítanie) | 4 | 5 | 3 | 2 | 4 | 3 | 4 | 2 | 5 – jedno kliknutie |
| 5. Power Automate Desktop (schválená automatizácia) | 3 | 4 | 3 | 2 | 4 | 3 | 4 | 2 | 5 |
| 6. Lokálny SAP Bridge (program na PC) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 | 4 |
| 7. OCR zo snímky obrazovky / fotky | 4 | 3 | 2 | 5 | 4 | 2 | 5 | 5 | 2 – kontrola nejasných buniek |
| 8. Plánovaný export reportu zo SAP do zabezpečeného priečinka + Bridge na serveri | 4 | 5 | 5 | 2 | 5 | 4 | 4 | 2 | 5 – nič |
| 9. Oficiálne rozhranie SAP (OData / RFC-BAPI) | 2–3 | 5 | 5 | 1 | 5 | 2 | 3 | 1 | 5 – nič, aj spätný zápis |
| SAP GUI Scripting / VBA | 1 | – | – | – | – | – | – | – | nevhodné: pracujete v Edge, skriptovanie býva vypnuté |

Poznámky k hodnoteniu:
- **1 + 2 + 3** sú v skutočnosti jedna funkcia „Import centrum“ s troma vstupmi. Fungujú bez
  inštalácie a bez zásahu do SAP-u – potrebné je len povolenie spracúvať údaje v Plánovači.
- **4** je najpohodlnejšie, ale rozšírenie musí IT povoliť (politika Edge) a pri aktualizácii SAP
  obrazoviek sa môže pokaziť; preto ho navrhujem ako doplnok, nie základ.
- **5 a 6** dokážu aj zapisovať, ale automatické klikanie v úradnom systéme je krehké a riskantné –
  zápis odporúčam len cez oficiálne rozhranie alebo s potvrdením človekom.
- **7** je záloha: technicky funguje offline (OCR priamo v prehliadači), ale chyby rozpoznania sú
  nevyhnutné – návrh preto počíta s povinnou kontrolou (kap. 5).
- **8** je podľa mňa **najlepší pomer prínosu a náročnosti z dlhodobých riešení**: SAP tím nemusí
  nič programovať, stačí naplánovať existujúci report s exportom (napr. každých 15–60 minút)
  do priečinka, ktorý číta Plánovač. Výsledok: plne automatické čítanie bez klikania.
- **9** je najčistejšie a jediné umožní bezpečný automatický **spätný zápis**, ale vyžaduje
  technického používateľa, oprávnenia a prácu SAP tímu.

---

## 3. Odporúčanie

| Horizont | Riešenie | Čo plánovačovi zostane |
|---|---|---|
| **Ihneď** (bez IT, testovateľné na fiktívnych údajoch dnes) | **Import centrum** (súbor Excel/CSV, schránka, voliteľne sledovaný priečinok) + **kontrola zhody** + **asistovaný zoznam zmien pre SAP** | export v SAP-e (~1 min), potvrdenie náhľadu |
| **Najlepšie dlhodobo** | **SAP Bridge na internom serveri**: čítanie z plánovaného exportu (8), neskôr z oficiálneho rozhrania (9); spätný zápis schválených zmien cez rozhranie | iba schvaľovanie návrhov |
| **Záloha** (IT nepovolí rozšírenie ani rozhranie) | ručný export + import; ak nie je povolený ani export, **OCR zo snímky obrazovky** s povinnou kontrolou a rýchle ručné zadanie | export alebo snímka + kontrola nejasných miest |

**Smer Plánovač → SAP** (prvotné zadanie mesačného plánu a schválené opravy):

1. **Asistované zadávanie (bez IT):** zoznam zmien zoradený tak, ako sa zadáva v SAP-e, pri každej
   položke tlačidlo „kopírovať“ a zaškrtávacie pole „zadané“. Ďalší import automaticky overí, že
   v SAP-e je všetko správne (zelená fajka) – chyby z prepisovania sa odhalia hneď.
2. **Súbor na nahratie do SAP-u** – ak IT poskytne nahrávací program alebo šablónu.
3. **Predvyplnenie cez rozšírenie Edge** – človek skontroluje a klikne „Uložiť“ v SAP-e.
4. **Zápis cez oficiálne rozhranie** po schválení v Plánovači (technický používateľ s minimálnymi
   právami, úplný audit).

Ďalší nápad na overenie s IT: ak sa PN/DOV schvaľujú v SAP-e cez workflow (samoobsluha/manažér),
notifikácie tohto workflow môžu byť ďalším automatickým zdrojom udalostí pre Plánovač.

---

## 4. Ako funguje Import centrum

| Krok | Popis |
|---|---|
| 1. Načítanie | súbor (XLSX/CSV), vloženie zo schránky, sledovaný priečinok, neskôr rozšírenie/Bridge/OCR – všetko spracované **lokálne** |
| 2. Rozpoznanie formátu | podľa hlavičiek; pri prvom importe sprievodca priradí stĺpce, potom si to pamätá („profil importu“) |
| 3. Normalizácia | osoby podľa **osobného čísla** (meno len ako doplnok, s toleranciou preklepov); kódy SAP → kódy Plánovača cez mapovaciu tabuľku; dátumy a časy |
| 4. Kontrola úplnosti | rozsah dátumov, počet osôb, duplicity, neznáme kódy a osoby, dve služby v ten istý čas |
| 5. Porovnanie so zverejneným plánom | nová/zrušená neprítomnosť, pridaná/odobraná služba, náhrada (X namiesto Y), zmena času, nadčas |
| 6. Triedenie | **zhoda** · **zmena zo SAP** (prevziať) · **konflikt** (v SAP-e je niečo, čo porušuje pravidlá – upozorniť) · **nejasné** (rozhodne plánovač) |
| 7. Náhľad a potvrdenie | zaškrtávanie po položkách, „prevziať všetko bezpečné“ jedným klikom |
| 8. Uplatnenie | jedna transakcia = jedna verzia plánu, dá sa vrátiť |
| 9. Oprava | nepokryté služby idú rovno do režimu opráv |
| 10. Kontrola zhody | stav zhody so SAP na hlavnom paneli |

### Bezpečné spracovanie neúplných a chybných údajov

- **Čo v exporte chýba, sa nemaže.** Ak export pokrýva len 1.–15.10., dni 16.–31. sa označia ako
  „neoverené“, nie ako zrušené služby. Rovnako chýbajúca osoba ≠ osoba bez služieb.
- Rovnaký súbor sa nenačíta dvakrát (kontrolný súčet); import je idempotentný.
- Neznámy kód alebo nejednoznačné meno (dvaja „Martin“) zastaví len danú položku a vyžiada
  rozhodnutie; rozhodnutie sa zapamätá.
- Podozrivé množstvo zmien (napr. > 30 % plánu) vyžaduje výslovné potvrdenie – chráni pred
  omylom pri výbere nesprávneho súboru alebo mesiaca.
- Nič sa neuplatní bez náhľadu a potvrdenia.

---

## 5. OCR ako záloha – návrh s počítaním s chybami

1. Snímka obrazovky (Win+Shift+S) → Ctrl+V do Plánovača (alebo fotka).
2. Rozpoznanie mriežky tabuľky, OCR po bunkách **priamo v prehliadači** (knižnica zabalená v
   aplikácii, žiadne externé služby), povolené len znaky služieb.
3. Každá bunka sa porovná so **slovníkom platných kódov** (`7-19`, `19-7`, `S 7-19`, `PN`…),
   mená so zoznamom osôb, dátumy s hlavičkou.
4. Každá bunka dostane mieru istoty. Nejasné bunky (napr. `7-19` vs. `1-19`) sa zobrazia
   **s výrezom obrázka priamo vedľa rozpoznanej hodnoty**, aby kontrola trvala sekundy.
5. Kontrola úplnosti: očakávaný počet riadkov (osôb) a stĺpcov (dní); chýbajúce = neoverené.
6. Porovnanie s plánom – plánovač potvrdzuje **iba rozdiely**, nie celú tabuľku.
7. Bez potvrdenia sa nič neuplatní; nízka istota sa nedá „prekliknúť“ bez rozhodnutia.

---

## 6. Čo potrebujeme zistiť o pracovnom SAP-e (kontrolný zoznam pre IT)

1. Aký systém a verzia (SAP ECC HCM, S/4HANA, SuccessFactors…) a ako sa otvára v Edge
   (SAP GUI for HTML, Fiori Launchpad, portál)?
2. **Kde presne sa vedie rozpis služieb** – transakcia/aplikácia (napr. plánovanie zmien PP60/PP61,
   časové údaje PA61 – infotypy 2001 neprítomnosti, 2002 prítomnosti, 2003 zastupovanie,
   2005 nadčasy, alebo vlastná Z-transakcia)?
3. Dá sa z tejto obrazovky **exportovať do Excelu/CSV** (ALV „Export → Tabuľkový procesor“)?
   Ukážkový export s **anonymizovanými/fiktívnymi** údajmi (stačí štruktúra stĺpcov).
4. **Číselníky:** kódy denných pracovných plánov/zmien, typy neprítomností (PN, DOV, CHV…),
   prítomností a nadčasov – na mapovaciu tabuľku.
5. **Identifikátory:** osobné číslo, organizačná jednotka.
6. Dá sa naplánovať **pravidelný export reportu** do zabezpečeného sieťového priečinka alebo
   internej pošty? Ako často?
7. Existuje **OData (SAP Gateway) alebo RFC/BAPI** rozhranie na čítanie (a zápis) časových údajov?
   Pravidlá pre technických používateľov?
8. Existuje **nahrávací program** na hromadné zadanie plánu?
9. Politika pre **rozšírenia Edge**, Power Automate Desktop, spúšťanie programov a lokálne porty.
10. **Klasifikácia údajov** rozpisu, kde smú byť uložené (server, PC), doba uchovávania, požiadavky
    na logovanie; stanovisko zodpovednej osoby (PN = údaj o zdraví).
11. Interný server (OS, Docker), HTTPS certifikát, Active Directory na prihlasovanie.
12. Prístup policajtov z mobilu do vnútornej siete (VPN)?

---

## 7. Prototyp s fiktívnymi údajmi (etapa 2 po schválení)

- **Generátor fiktívnych „SAP exportov“** v niekoľkých tvaroch: dlhý formát (osobné číslo, meno,
  dátum, kód, od, do, typ), plachta (osoby × dni), CSV so slovenskými dátumami a bodkočiarkou,
  plus zámerne poškodené varianty (chýbajúce dni, neznámy kód, duplicita, preklep v mene).
- **Import** pretiahnutím súboru a vložením zo schránky, sprievodca mapovaním, kontrola úplnosti,
  porovnanie s plánom a triedenie zmien.
- **Ukážkový scenár end-to-end:** októbrový plán → fiktívny export z 10.10. s PN Mareka 10.–20.10.
  a náhradou Rasťa 12.10. → import zistí 1 prevzatú a niekoľko nepokrytých služieb → režim opráv
  ponúkne varianty → schválenie → zoznam zmien pre SAP → ďalší export → **Zhoda so SAP ✔**.
- Neskôr (etapa 6): fiktívna stránka podobná SAP-u na vyskúšanie rozšírenia Edge a OCR.

---

## 8. Bezpečnostné hranice

- Skutočný prístup do SAP-u, spracúvanie služobných údajov a akýkoľvek zápis **až po výslovnom
  schválení organizáciou** (IT a bezpečnostný útvar).
- Nikdy nezískavam ani neukladám prihlasovacie údaje, cookies ani interné prístupové tokeny SAP-u;
  žiadne obchádzanie bezpečnostných obmedzení.
- Začíname **iba čítaním**; zápis len schváleným mechanizmom s auditom.
- Rozšírenie Edge (ak bude povolené): minimálne oprávnenia, beží len na adrese SAP-u určenej IT,
  číta len zobrazenú tabuľku po kliknutí používateľa, posiela údaje výlučne na interný Plánovač.
- Údaje neopustia vnútornú sieť; súbory sa spracúvajú lokálne; každý import sa zaznamená
  (kto, kedy, kontrolný súčet súboru, výsledok).
