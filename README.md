# Finances

App web de control financer personal, pensada per al mòbil i instal·lable a l'iPhone (PWA).
Tota en català i en euros. **Sense backend, sense login i sense núvol**: les dades viuen només al
dispositiu (IndexedDB).

Respon a: quant ingresso i quant gasto cada mes (i en què), si gasto més del que ingresso i quina
taxa d'estalvi tinc, com evoluciona el patrimoni líquid, com es reparteixen els diners entre els
comptes i si compleixo els pressupostos.

Decisions tècniques: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Funcionalitats

| Pantalla | Què fa |
| --- | --- |
| Onboarding | Benvinguda i creació dels comptes amb saldo i data inicial: tants com calgui de cada tipus (per exemple, dos comptes remunerats amb TAE diferents), amb el total del patrimoni inicial. També permet restaurar una còpia. |
| Resum | Ingressos, despeses, balanç (superàvit/dèficit i taxa d'estalvi), patrimoni líquid, ritme de despesa amb projecció i despeses per categoria (donut + llista que porta a Moviments). |
| Moviments | Llista per dies, cercador, filtres (tipus, categoria, compte, rang de dates), detall amb editar i eliminar. |
| Afegir moviment | Full inferior: import enfocat amb teclat numèric → categoria (per freqüència d'ús) → Guardar. Despesa, ingrés o transferència; pagament únic o recurrent. |
| Anàlisi | Categoria principal, despeses per categoria, comparació amb el mes anterior i gràfics dels últims 6 mesos. |
| Patrimoni | Total, distribució per comptes i evolució (30 dies a tot l'historial) amb estadístiques. |
| Més | Pressupost (per defecte i per mes), comptes, categories, recurrents i dades (CSV, còpies de seguretat, esborrar-ho tot). |

Els moviments recurrents i els interessos mensuals dels comptes remunerats es generen sols cada
vegada que s'obre l'app, sense duplicats.

## Desenvolupament

Requisits: Node 20.19 o superior.

```bash
npm install
npm run dev          # http://localhost:5173
```

Comprovacions:

```bash
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e   # Playwright (Chromium) a 375 i 430 px
```

Les icones es generen des de l'SVG amb `npm run icons`.

## Desplegament a Vercel

1. Importa el repositori a Vercel (*Add New… → Project*). El *framework preset* és **Vite** i la
   configuració ja és a `vercel.json` (build `npm run build`, sortida `dist`, reescriptura de rutes
   de l'SPA).
2. No cal cap variable d'entorn ni base de dades.
3. Cada `git push` torna a desplegar. Les dades són al telèfon, no al servidor: un desplegament no
   les toca, i l'app instal·lada s'actualitza sola a la versió nova.

## Instal·lar-la a l'iPhone

Obre l'URL amb Safari → botó Compartir → **Afegir a la pantalla d'inici**.

> Les dades només es guarden en aquest dispositiu. Si s'esborra l'app de la pantalla d'inici (o les
> dades de Safari), es perden. Fes còpies de seguretat a **Més → Dades** i guarda-les, per exemple, a
> iCloud Drive. Per passar a un altre telèfon, restaura-hi la còpia des de la pantalla de benvinguda.
