# Publicare pe GitHub Pages

## 1. Pregătește proiectul

1. Descarcă arhiva ZIP.
2. Apasă click dreapta pe arhivă.
3. Alege `Extract All`.
4. Deschide folderul extras.
5. Verifică să vezi `package.json`, `src`, `public`, `supabase` și `.github`.

Nu încărca arhiva ZIP în repository. Încarcă fișierele și folderele din interiorul ei.

## 2. Creează repository-ul

1. Intră pe `https://github.com`.
2. Autentifică-te.
3. Apasă butonul `+` din dreapta sus.
4. Alege `New repository`.
5. La nume scrie `car-work-tracker`.
6. Alege `Public` dacă folosești GitHub Free pentru Pages.
7. Nu selecta README, `.gitignore` sau licence. Proiectul le conține deja.
8. Apasă `Create repository`.

## 3. Încarcă proiectul

1. În repository apasă `Add file`.
2. Alege `Upload files`.
3. Selectează toate fișierele și folderele din folderul extras.
4. Verifică să apară și `.github/workflows/deploy.yml`.
5. La mesaj scrie `Initial Car Work Tracker upload`.
6. Salvează direct în branch-ul `main`.
7. Apasă butonul pentru commit.

## 4. Activează GitHub Pages

1. Deschide `Settings` în repository.
2. În meniul din stânga deschide `Pages`.
3. La `Build and deployment`, găsește `Source`.
4. Selectează `GitHub Actions`.
5. Nu crea alt workflow. Proiectul conține deja workflow-ul corect.

## 5. Verifică publicarea

1. Deschide tab-ul `Actions`.
2. Selectează `Deploy to GitHub Pages`.
3. Așteaptă bifa verde.
4. Revino la `Settings`, apoi `Pages`.
5. GitHub afișează adresa aplicației. De obicei are forma `https://NUMELE-TAU.github.io/car-work-tracker/`.

## 6. Configurează Supabase

GitHub Pages publică interfața. Datele online au nevoie de Supabase.

1. Creează un proiect Supabase.
2. Deschide `SQL Editor`.
3. Copiază conținutul fișierului `supabase/schema.sql`.
4. Rulează scriptul o singură dată. Dacă ai instalarea veche, rulează din nou scriptul actualizat.
5. În Supabase deschide `Project Settings`, apoi `API`.
6. Copiază `Project URL` și cheia publică `anon`.
7. În aplicație deschide `Setări`.
8. Introdu URL-ul și cheia publică.
9. Salvează configurarea.
10. Creează contul din aplicație și încarcă datele online.

Nu introduce cheia `service_role` în aplicație sau GitHub.

## 7. Actualizări viitoare

1. Deschide repository-ul.
2. Apasă `Add file`, apoi `Upload files`.
3. Încarcă fișierele noi peste cele vechi.
4. Fă un commit în `main`.
5. GitHub Actions reconstruiește și publică aplicația automat.
