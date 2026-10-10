# Arquitectura

Decisions tècniques de l'app i per què. L'especificació funcional és la de la conversa que va
originar la versió 2 (app en català, només al dispositiu).

## 1. Restriccions

| Requisit | Conseqüència |
| --- | --- |
| Sense backend, ni login, ni núvol | Totes les dades viuen a **IndexedDB** del navegador (Dexie). L'app és estàtica i es pot servir des de qualsevol CDN (Vercel). |
| Instal·lable a l'iPhone i sense connexió | PWA amb manifest, icones i *service worker* que precarrega tota l'app. |
| Les dades no es poden perdre | Migracions de Dexie versionades, `navigator.storage.persist()` en arrencar i còpies de seguretat JSON. |
| Imports exactes | Cèntims enters a tot arreu; només es divideix per 100 per mostrar. |
| Dates sense sorpreses de zona horària | Dates `YYYY-MM-DD` del calendari local; l'aritmètica es fa en UTC. |

## 2. Stack

| Capa | Elecció |
| --- | --- |
| Build | Vite 8 + React 19 + TypeScript |
| Estils | Tailwind CSS 4 (tokens a `src/index.css`), `tailwind-merge` a `cn()` |
| Dades | Dexie 4 (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`) |
| Rutes | React Router 7 (URLs en català: `/moviments`, `/mes/pressupost`…) |
| Gràfics | Recharts 3 (carregats a demanda) |
| PWA | `vite-plugin-pwa` (Workbox, `registerType: 'autoUpdate'`) |
| Tests | Vitest (+ `fake-indexeddb`) i Playwright (Chromium a 375 i 430 px) |

## 3. Estructura

```
src/
  texts.ts              tots els textos (català)
  lib/                  lògica pura, sense React ni Dexie
    money.ts            cèntims ↔ text, format «1.831,57 €» (agrupació forçada)
    dates.ts            dates locals i noms catalans (dl., «5 d'oct.», «octubre 2026»)
    validation.ts       validacions compartides per formularis i capa de dades
    finance/            regles financeres (saldos, flux, ritme, pressupost, recurrents, interessos, patrimoni)
    backup.ts csv.ts    formats d'exportació
  db/
    db.ts               esquema Dexie versionat
    repo.ts             totes les escriptures (transaccions atòmiques)
    automation.ts       recurrents i interessos pendents (en obrir l'app)
    seed.ts             categories inicials i paleta
  state/                DataProvider (vista viva de tota la BD) i estat de l'app (avui, mes)
  components/           UI, fulls inferiors, gràfics
  pages/                pantalles
```

## 4. Model de dades

Taules (`src/lib/types.ts`): `accounts`, `categories`, `transactions`, `recurringRules`, `budgets`,
`settings` (clau-valor). Tots els comptes són líquids. No hi ha taula de *snapshots*: el patrimoni
de qualsevol dia es reconstrueix a partir dels saldos inicials i dels moviments, així quadra encara
que s'editi un moviment antic.

```
saldo(D) = saldo inicial (si la seva data ≤ D)
         + ingressos − despeses − transferències sortints + transferències entrants   (amb data ≤ D)
```

Les transferències canvien els saldos però **mai** compten com a ingrés o despesa (balanç, taxa
d'estalvi, pressupostos, gràfics de flux).

Les dades són petites (milers de files), així que `DataProvider` llegeix totes les taules amb
`useLiveQuery` i les pantalles en deriven els càlculs amb funcions pures de `lib/finance`. Qualsevol
escriptura actualitza automàticament totes les pantalles i gràfics.

### Migracions

`src/db/db.ts` declara `version(1)`. Per canviar l'esquema s'afegeix `version(2).stores(...).upgrade(...)`
i **mai** es modifica una versió existent. Si canvia el format de les files, cal pujar també
`BACKUP_SCHEMA_VERSION` (`src/lib/backup.ts`) i saber llegir les còpies antigues.

## 5. Feina «de servidor» sense servidor

En obrir l'app (i quan torna a primer pla o canvia el dia) `runAutomation(avui)`:

1. **Recurrents**: per a cada regla activa, crea els moviments des de `lastGeneratedDate` (o la data
   d'inici) fins avui. El dia 31 passa a l'últim dia dels mesos curts. Les ocurrències es calculen
   a partir de la regla, no de l'anterior, i per tant no es desplacen.
2. **Interessos** dels comptes remunerats amb TAE > 0: per a cada mes acabat no processat crea un
   ingrés l'últim dia del mes: `TIN = 12 × ((1 + TAE/100)^(1/12) − 1)`, brut = Σ saldo diari × TIN / 365,
   net = brut × (1 − retenció/100), arrodonit a cèntims. Els mesos es processen en ordre (l'interès
   d'un mes compta en el saldo del següent).

És idempotent: tot passa dins d'una transacció d'IndexedDB (serialitzada entre pestanyes), el
marcador (`lastGeneratedDate`, `settings.interestProcessed`) avança amb les insercions i els ids són
deterministes (`rec_<regla>_<data>`, `int_<compte>_<mes>`). Un moviment generat que s'edita o
s'elimina no es torna a crear. Pausar una regla i reprendre-la no crea el període pausat.

## 6. PWA i iPhone

- Manifest (`vite.config.ts`): `display: standalone`, colors blancs, icones 192/512 i *maskable*;
  `apple-touch-icon` 180×180 i metadades `apple-mobile-web-app-*` a `index.html`.
- `viewport-fit=cover` i `env(safe-area-inset-*)` a la capçalera, la barra inferior, el botó «+» i els
  fulls inferiors; alçades amb `dvh`; inputs de 16 px (sense zoom); zones tàctils ≥ 44 px.
- Fulls inferiors amb `<dialog>` natiu (capa superior: sempre per sobre de la barra) i el botó
  Guardar fora de la zona que fa scroll. El `<dialog>` cobreix exactament la zona visible
  (`visualViewport.height` i `offsetTop`) i el full s'alinea a sota de tot, de manera que acaba just
  per sobre del teclat. No es calcula l'alçada del teclat a partir de `window.innerHeight`: a iOS 26
  també s'encongeix i el full quedava amagat darrere el teclat (`tests/e2e/keyboard.spec.ts` ho
  simula).
- Entrada ràpida: el «+» enfoca un input numèric ocult durant el toc (iOS només obre el teclat
  així) i el full passa el focus al camp Import.
- El *service worker* precarrega l'app; una versió nova s'activa sola. Les dades són a IndexedDB i
  una actualització no les toca.
- Vercel: `vercel.json` reescriu totes les rutes a `index.html` (SPA) i no guarda en memòria cau ni
  `sw.js` ni `index.html`.

## 7. Tests

- `npm test` (Vitest): format i parseig d'imports, dates catalanes, saldos, transferències fora del
  flux, balanç i taxa d'estalvi, projecció del ritme, pressupostos (per defecte i personalitzat),
  recurrents (sense duplicats, dia 31, data de fi, pausa), interessos (saldo variable, retenció,
  sense duplicats), evolució del patrimoni, CSV i còpies de seguretat (exportar → esborrar →
  restaurar), sobre una IndexedDB en memòria.
- `npm run test:e2e` (Playwright, sobre el *build* de producció, a 375 i 430 px): el flux complet de
  l'especificació, validacions, PWA sense connexió i comprovacions de disseny a cada pantalla (cap
  scroll horitzontal, cap import tallat, partit o desbordat, inputs ≥ 16 px, zones tàctils ≥ 44 px i
  cap text en castellà o anglès).
