# A.R.I.S. v1.4.3

## Ce primești

- temă întunecată A.R.I.S., inspirată de interfețele futuriste
- centru de comandă pentru săptămâna selectată
- analiză pe 7, 30, 90 de zile sau toate datele
- jurnal zilnic cu stare, ore, minute productive, așteptare și transport
- zile fără job afișate separat, cu motiv
- comparație între plata estimată și plata PDF
- pierderea ascunsă pentru perioade incomplete
- rute și postcoduri ordonate după profit
- recorduri personale și comparație cu săptămâna anterioară
- analiză de oboseală, zi lungă și timp de odihnă
- scor de performanță și scor pentru calitatea datelor
- rezervă TVA și rezervă Income Tax
- Standard VAT cu metoda Accrual sau Cash Accounting
- editare completă pentru mașinile livrate
- calcul estimativ al rutei directe din postcode-ul de colectare și cel de livrare
- separarea milelor plătibile de distanța reală condusă
- raport imediat după încărcarea PDF-ului, cu toate mașinile, milele și plățile
- detectarea Job Ref-urilor duplicate și a informațiilor lipsă din PDF
- interfață A.R.I.S. HUD refăcută, cu reactor, telemetrie, scanări și culori high-tech
- trei totaluri separate: date introduse manual, date extrase din PDF și total combinat
- combinare după Job Ref, fără dublarea aceleiași mașini
- prioritate pentru milele și plata finală din PDF
- încărcare simultană pentru mai multe PDF-uri
- blocarea unui PDF identic și a unei săptămâni deja importate

## Date necesare pentru rezultate bune

Pentru fiecare job:

- Job Ref
- data colectării și livrării
- milele reale sau milele din PDF
- localitatea ori postcode-ul de colectare
- localitatea ori postcode-ul de livrare
- suma plătită

Milele plătibile folosesc această ordine:

1. milele din PDF
2. ruta directă estimată după postcode
3. valoarea directă introdusă manual

Drumul până acasă poate fi înregistrat separat ca distanță reală condusă. Nu schimbă tariful jobului.

Pentru fiecare zi:

- ora plecării de acasă
- ora întoarcerii
- minute productive
- minute de așteptare
- minute în transport public
- motivul unei zile fără activitate

Pentru taxe:

- perioada corectă
- confirmarea că sumele RAS includ VAT
- tratamentul rambursărilor
- documentele VAT pentru cheltuieli, dacă vrei Box 4

## Formule principale

- VAT inclus = total brut × rata VAT / (100 + rata VAT)
- vânzări fără VAT = total brut - VAT inclus
- profit înainte de Income Tax = venit brut - VAT - costuri - taxe administrative
- profit real = profit înainte de Income Tax - rezerva Income Tax
- câștig real pe oră = profit real / orele dintre plecare și întoarcere
- profit pe mașină = profit real / numărul de mașini
- câștig pe milă = venit brut / mile
- cheltuieli recuperate = cheltuieli aprobate / cheltuieli cerute

## Publicare pe GitHub

1. Descarcă arhiva completă.
2. Extrage fișierele.
3. Înlocuiește fișierele din repository cu cele din arhivă.
4. Nu încărca folderul node_modules.
5. Fă un commit cu mesajul `A.R.I.S. v1.4.3 Jarvis HUD`.
6. Trimite schimbările pe branch-ul main.
7. GitHub Actions reconstruiește și publică aplicația.

## Fișiere principale modificate

- src/pages/Performance.tsx
- src/pages/History.tsx
- src/pages/Deliver.tsx
- src/pages/Payslips.tsx
- src/lib/performance.ts
- src/lib/routeMiles.ts
- src/lib/analytics.ts
- src/store/DataContext.tsx
- src/aris.css
- src/lib/tax.ts
- src/pages/Tax.tsx
- src/store/DataContext.tsx
- src/types.ts
- src/components/AppShell.tsx
- src/App.tsx
- src/lib/supabase.ts
- public/manifest.webmanifest
- public/sw.js
