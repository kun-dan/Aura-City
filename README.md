# Auracity

Auracity is a civic issue reporting app for Indian cities. A citizen reports a problem (pothole, water leak, broken streetlight, garbage) with one photo and a map pin. An AI model looks at the photo, decides the department and assigns a worker. When the worker uploads an "after" photo, the AI checks the repair and the worker is paid from the city budget only if the fix looks genuine. All payments are recorded in a public ledger.

## Features

- Report an issue with a photo and a pin on the map
- AI classification of the report (category, severity, department)
- Automatic assignment to the resolver with the fewest active jobs
- Resolver jobs with before/after photos
- AI audit of the repair, with admin review when the AI is not sure
- Wallet, platform fee and ledger for every payout
- Upvotes, points and a leaderboard for citizens
- City Mood voting
- AuraBot, a chat guide for each role
- Admin dashboard with budget, pending audits, contractor ratings and user roles
- Map view of all issues

## Tech stack

- Web app: React, Vite, TypeScript
- Mobile app: Expo (React Native), expo-router, plain JavaScript
- Backend: Supabase (Postgres, Row Level Security, Realtime, Storage, Edge Functions)
- AI: Groq, model `qwen/qwen3.8-27b`
- Maps: Leaflet with OpenStreetMap

## Folder structure

```
src/                  web app
  components/         shared UI components
  lib/                api, demo backend, business rules, types
  pages/              screens
  state/              auth and data hooks
mobile/               Expo app
  src/app/            expo-router routes
  src/components/     UI components and the Leaflet map
  src/lib/            on-device api, Groq client, rules, seed data
  src/screens/        screens
  assets/scenes/      sample photos
supabase/
  migrations/         database schema, policies and functions
  functions/          classify-issue, audit-resolution, aurabot
```

## Run the web app

```
npm install
npm run dev
```

Then open http://localhost:5173. If the Supabase variables are not set (see below), the web app runs in a local demo mode that keeps data in the browser and uses simple stand-ins for the AI.

## Run the mobile app

```
cd mobile
npm install
EXPO_PUBLIC_GROQ_API_KEY=your_key npx expo start
```

Scan the QR code with Expo Go. To build an APK:

```
npx eas-cli build -p android --profile preview
```

The mobile app currently stores its data on the device. The Groq key is compiled into the app, so only use this for demo builds.

## Set up Supabase

1. Create a Supabase project, link it and apply the migration:
   ```
   supabase link --project-ref your_ref
   supabase db push
   ```
2. Set the Groq key and deploy the three functions:
   ```
   supabase secrets set GROQ_API_KEY=your_key
   supabase functions deploy classify-issue
   supabase functions deploy audit-resolution
   supabase functions deploy aurabot
   ```
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

When these two variables are present the web app uses Supabase instead of the demo mode.

## Photo credits

The sample photos are Creative Commons licensed. Credits are in `mobile/assets/scenes/CREDITS.md`.

## Team

- Shivam Mishra (IIT2024215)
- Nitya Varma Datla (IIT2024217)
- Aadi Gosrani (IIB2024005)
- Adabala Sridhar (IIT2024218)
- Lucky Indrakant Raut (IIB2024016)
- Malhar Udmale (IIB2024020)
