# Plánovač služieb 6.0 – dokumentácia

| Dokument | Obsah |
|---|---|
| [01-analyza-planovac-5.md](01-analyza-planovac-5.md) | Fáza 1: dátový model, inventár pravidiel R1–R24 (vrátane pravidla 32 h), inventár funkcií, overené chyby Z1–Z24 |
| [02-navrh-planovac-6.md](02-navrh-planovac-6.md) | Fáza 2 + 4–7: architektúra, zachovanie pravidiel, režim inteligentnej opravy, optimalizácia, roly, databáza, UI, testy, plán realizácie, otvorené rozhodnutia |
| [03-sap-integracia.md](03-sap-integracia.md) | Fáza 3: porovnanie spôsobov integrácie so SAP-om, odporúčanie, kontrolný zoznam pre IT, prototyp |
| [overenie/overenie-v47.js](overenie/overenie-v47.js) | Skript, ktorý na fiktívnych údajoch spustí pôvodný `index.html` a overí zistenia Z1–Z12 |

## Overenie zistení

```bash
npm install playwright        # jednorazovo, ak ešte nie je nainštalovaný
npx playwright install chromium
node docs/overenie/overenie-v47.js
```

Očakávaný výsledok: `Potvrdených zistení: 12/12`.

Pôvodná aplikácia (`index.html`) v tejto vetve **nie je zmenená**; produkčná verzia vo vetve `main`
zostáva nedotknutá.

## Aplikácia (Plánovač 6.0)

`index.html` – jeden súbor, otvorí sa dvojklikom v Edge/Chrome, údaje ostávajú v prehliadači.
Pôvodná verzia je zachovaná v `legacy/planovac-5.0-v47.html`.
Testy: `node tests/regression.js` (29 testov na fiktívnych údajoch).
SAP integrácia je zámerne vynechaná (pozri `03-sap-integracia.md`) a doplní sa po zistení, ako SAP funguje.
