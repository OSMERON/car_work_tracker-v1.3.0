# A.R.I.S. Car Work Tracker

A bilingual Romanian and English React PWA for vehicle collections and deliveries, mileage, expenses, performance, weekly PDF checks and UK tax drafts.

Version 1.4 adds the A.R.I.S. driver intelligence dashboard. It includes real hourly earnings, real profit, payment comparison, expense recovery, earnings per car and mile, productive time, route performance, weekday performance, personal records, fatigue alerts, data quality and daily work status. Missing days appear as no work or unconfirmed. Payment losses stay hidden until every relevant week is complete and has a payslip.

Version 1.4.2 includes the complete type definitions required by DataContext and a GitHub-ready full package. It also adds full editing for delivered cars, separates payable route miles from actual miles driven, estimates the direct pickup-to-delivery route from UK postcodes, and shows every recognised car immediately after a PDF upload. PDF miles remain authoritative when available. The route estimate never includes travel home.

The VAT area now uses Standard VAT with Accrual or Cash Accounting. It extracts output VAT from VAT-inclusive RAS totals when selected. Input VAT remains zero until an expense has an eligible VAT amount and valid evidence. The app creates a reviewable nine-box draft. It does not submit a return to HMRC.

Version 1.1 adds a completed-job catch-up screen. Job Ref is the required identifier and registration is optional. Weeks remain marked incomplete until you confirm that every job has been entered. Personal payment differences and possible losses are hidden while a week is incomplete, but the PDF's own arithmetic is still checked.

Version 1.2 stores newly uploaded payslip PDFs in the browser using IndexedDB. Use **View PDF** on the Payslips page to read the original document inside the app, open it separately or download it. Existing imported records need their original PDF uploaded once before the viewer is available.

Version 1.3 added daily, weekly and monthly work reports. Uploading a payslip PDF updates matching jobs, mileage, paid job amounts, approved expenses, reports and the tax draft.

The included starter data was imported from the supplied Excel workbook and nine PDF reports. Duplicate payslip week `20/07/2026` was imported only once. Starter data contains 60 jobs, 141 expense entries and 8 unique payslip weeks.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run preview
```

## Publish on GitHub Pages

See `GITHUB_SETUP_RO.md` for a Romanian step-by-step guide.

1. Create a new GitHub repository.
2. Upload all files from this project, or push them with Git.
3. In the repository open **Settings > Pages**.
4. Under **Build and deployment**, select **GitHub Actions**.
5. Push to the `main` branch. The included workflow builds and publishes the app.

The Vite base path is `./`, so the app works in a project repository without editing the repository name.

## Set up Supabase cloud sync

The app works immediately without Supabase and keeps data in the browser. To use the same data on multiple devices:

1. Create a free project at Supabase.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it once. If upgrading an older installation, run the current schema again to add the synced week-completion setting.
3. In **Authentication > Providers**, keep Email enabled.
4. In **Project Settings > API**, copy the Project URL and `anon` public key.
5. Open the app's Settings page, paste both values, save, and create an account.
6. Use **Upload data** on the first device, then **Download online data** on another device.

Never use the Supabase `service_role` key in this app. The public `anon` key is intended for browser apps. Row Level Security in the included schema limits every user to their own records.

## Payslip PDF check

Open **Payslips**, upload the weekly PDF and review:

- the PDF's own arithmetic
- your expected mileage tariff versus the reported job payment
- reward, expenses, bonus, deductions and administration charge
- job references missing from either side
- an alert when the total difference is more than £10
- automatic update of the calendar, reports and tax draft

The parser supports both supplied report layouts: the older Job Report and the newer Contractor Service Report. It recognises both currency orders, including `£ 21.50` and `21.50 £`, plus Rewards or Delivery Time Uplift, Bonus or Additional Fees, and Administration Charge or Insurance Contribution. PDF layouts can change, so every imported result remains visible and the original PDF should be kept. The result is a transparent reconciliation aid, not accounting or legal advice.

## UK tax drafts

The VAT page follows the standard nine-box UK VAT Return structure. It is configured for Standard VAT. Choose Accrual or Cash Accounting, confirm whether RAS figures include VAT, and select the treatment of reimbursed travel costs. Box 4 only includes VAT amounts explicitly marked as reclaimable. The app produces a reviewable draft and does not submit data to HMRC. Direct submission requires an approved HMRC MTD API integration, OAuth authorisation, fraud prevention headers and production credentials.

The Income Tax summary groups digital records for MTD quarterly review. Quarterly updates are summaries of income and expenses, not the final tax calculation.

## Data and backups

The app is local-first. It saves changes in browser storage immediately. Settings includes JSON backup/restore and CSV export. Export a JSON backup regularly and before clearing browser data.

## Mileage tariff

The current mileage bands are in `src/lib/rates.ts`. Update that file if the contract tariff changes. A payslip calculation can only be as accurate as the configured rates and the work data entered.
