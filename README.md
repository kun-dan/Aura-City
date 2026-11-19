# Auracity

An AI-driven civic monitoring platform. Citizens report civic issues with one photo. A Vision AI sends each report to the right department. The city pays a worker only after the AI checks the repair.

**Report → Classify → Resolve → Audit & Pay**, all linked in one auditable chain.

| Role | What they do |
|---|---|
| Citizen | Report with a photo + map pin, upvote, vote on City Mood, earn points, see live status and spending |
| Resolver | See only their assigned jobs, upload an "after" photo, get paid to their wallet after the AI audit |
| City admin | Dashboard for the budget, pending audits, priority issues, contractor ratings, roles and the ledger |

## Run it (demo mode, no keys needed)

```bash
npm install
npm run dev
```

Open http://localhost:5173 and pick a demo account. Demo mode keeps all data in browser storage and uses simple scripted stand-ins for the AI. Open a second tab as another role (for example a citizen and a resolver side by side) and the pins and statuses update live across tabs.

Try this:
1. As **Asha (citizen)**, report an issue. Use the note "deep pothole near the bus stop". It goes to Roads and is assigned to Ravi.
2. As **Ravi (resolver)**, open the job and upload the *same* photo as the after photo. The auditor rejects it. Upload a different photo and the job is approved, with the payment going to Ravi's wallet.
3. As **Neha (admin)**, approve the water-leak audit that is waiting for review, and check the ledger.

## Run it for real (Supabase + Groq)

1. Create a Supabase project. Apply the migration:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
2. Deploy the edge functions and set the Groq key (the key stays on the server and never reaches the browser):
   ```bash
   supabase secrets set GROQ_API_KEY=...
   supabase functions deploy classify-issue
   supabase functions deploy audit-resolution
   supabase functions deploy aurabot
   ```
   Optional: `GROQ_VISION_MODEL` (default `meta-llama/llama-4-scout-17b-16e-instruct`) and `GROQ_CHAT_MODEL`.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Sign up in the app. Make yourself the first admin in the SQL editor:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@city.gov.in');
   ```
   After that, admins promote workers to resolvers from **Dashboard → Users**.

## Architecture

```
React (Vite + TS) ──► Supabase Postgres (RLS, Realtime, Storage)
   │                        ▲  SECURITY DEFINER functions:
   │                        │  apply_classification · submit_resolution · record_audit
   │                        │  release_payment · review_audit · assign_issue · topup_budget
   └──► Edge functions ─────┘
        classify-issue    ─► Groq Llama 4 Vision (strict JSON)
        audit-resolution  ─► Groq Llama 4 Vision (before vs after)
        aurabot           ─► Groq chat
```

- **`supabase/migrations/`** has the full schema, the Row Level Security policies, the triggers, and the payment engine.
  - Clients can't update issues, wallets, the treasury or the ledger directly. Column-level grants allow only the safe columns.
  - Every state change goes through a database function that checks the caller's role.
  - `release_payment` locks the treasury row and, in one transaction, debits the treasury, credits the wallet, takes the platform fee (2%) and writes the ledger.
  - The ledger can only be added to. Updates and deletes raise errors. Audit results can't be changed after they are written.
  - New sign-ups are always citizens, whatever role the client asks for.
- **Audit rule:** approve when the fix is legit, the rating is ≥ 3 and the confidence is ≥ 70%. A lower confidence sends the audit to an admin. Otherwise the job goes back to the resolver. If the treasury can't cover the payout, the audit is held for an admin instead of failing.
- **Points:** +10 for a valid report, +5 when it is fixed. **Bounty:** the department's base amount × a severity multiplier (0.8× to 1.6×).
- **City Mood:** the majority of each user's latest vote in the last 2 hours.
- **Maps:** Leaflet with OpenStreetMap/CARTO tiles, so no API key is needed. Photos are compressed in the browser before upload.

## Project layout

```
src/lib/api.ts            Api interface; picks Supabase or demo backend from env
src/lib/supabaseApi.ts    Production backend
src/lib/demoApi.ts        In-browser backend with heuristic AI stand-ins
src/lib/rules.ts          Shared business rules (points, thresholds, bounty)
src/pages/                Login, MapHome, Report, IssueDetail, ResolverJobs,
                          AdminDashboard, Transparency, Leaderboard
src/components/           IssueMap, MoodWidget, AuraBot, Layout
supabase/                 Migration + Groq edge functions
```

Team: Shivam Mishra · Nitya Varma Datla · Aadi Gosrani · Adabala Sridhar · Lucky Indrakant Raut · Malhar Udmale
