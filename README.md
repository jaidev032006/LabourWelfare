# LabourWelfare

LabourWelfare is a production-oriented, mobile-first service marketplace for customers who need reliable local help and workers who need a clear way to accept nearby jobs. The differentiator is an AI service triage flow: describe or photograph a problem, let Gemini suggest the service type, then let deterministic backend matching choose eligible nearby workers.

## What it solves

Finding a suitable professional is often harder than finding a phone number. LabourWelfare combines service categories, location-aware matching, verified worker profiles, availability, a two-minute acceptance window, automatic fallback, job status updates, reviews and admin visibility in one workflow.

## Architecture

- `public/`: vanilla HTML, CSS and JavaScript single-page client.
- `server/index.js`: Express API, Gemini integration, Socket.IO events and demo booking engine.
- `server/data.js`: clearly separated local demo data. Replace with repository queries backed by Supabase for production.
- `schema.sql`: normalized PostgreSQL schema for Supabase.
- `seed.sql`: initial categories and services.

The included local mode is intentionally runnable without cloud credentials so the UI and booking flow can be evaluated immediately. The schema defines the production persistence boundary: users, categories, services, skills, worker locations, bookings, booking attempts, reviews, notifications and admin actions.

## Stack

Node.js, Express 5, vanilla HTML5/CSS3/JavaScript, PostgreSQL through Supabase, Google Gemini, Socket.IO, Helmet, CORS, rate limiting, bcrypt and JWT.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:3000. Demo customer: `customer@demo.local` / `Demo@123`. Demo workers: `ravi@demo.local`, `meena@demo.local`, `imran@demo.local`, `nikhil@demo.local`, each with `Demo@123`.

## Environment variables

Set `PORT`, a long random `JWT_SECRET`, `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_ORIGIN`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. Never commit `.env`. Rotate any key that has been pasted into chat, a terminal transcript or source control.

## Supabase setup

Create a Supabase project, open SQL Editor, run `schema.sql`, then `seed.sql`. Move the in-memory arrays in `server/data.js` behind a repository layer using the Supabase server client. Keep the service role key server-side only. Enable row-level security for client-facing tables when direct client access is introduced.

## Gemini setup

Create a Gemini API key in Google AI Studio, put it in `GEMINI_API_KEY`, and restart the server. The key is read only by the backend. The server sends optional text and an image to Gemini and validates the returned category and service against an allow-list before matching workers. Without a key, a keyword-based local triage keeps the demo usable.

## Maps and location

The current demo stores lat/lng and shows distance using the Haversine formula. For deployment, add a server-side geocoding provider or a public Google Maps client key restricted by domain. Request browser location permission only while the customer or online worker is actively using location features; do not store worker locations while offline.

## Core flows

1. Customer registers or signs in.
2. Customer chooses Manual Search or AI Suggest, with optional image upload.
3. Gemini returns structured service guidance; the backend ranks online verified workers by compatibility, distance, availability, rating and experience.
4. Customer books a worker. The worker has exactly two minutes to accept or reject.
5. Timeout or rejection records a booking attempt and automatically contacts the next eligible worker.
6. Accepted workers update `on_the_way`, `arrived`, `work_started` and `completed` statuses. Socket.IO broadcasts updates.
7. Customers review completed work. Admins monitor platform statistics and booking activity.

## Security

Passwords are hashed with bcrypt. Authenticated routes use JWT role checks. Helmet, CORS, JSON limits, image size/type limits and rate limiting are enabled. Validate every user-controlled field again in a production persistence layer, use short-lived access tokens with refresh rotation, configure a real allow-list for CORS, and add audit logging around admin changes.

## Testing

```powershell
node --check server/index.js
npm test
```

For an integration smoke test, start the server and verify `GET /api/health`, register a customer, call `/api/ai/analyze` with a bearer token, create a booking, and log in as the selected worker to accept it. For production, add Supertest coverage for authorization, booking race conditions, expiry/fallback, invalid AI JSON, duplicate reviews and location privacy.

## Deployment

Deploy the Node process to Render, Railway or Fly.io with `npm start`, configure all environment variables, and set `FRONTEND_ORIGIN` to the deployed origin. A static host can serve `public/`, but the simplest first deployment serves it from Express as configured here. Run `schema.sql` and `seed.sql` in Supabase before enabling persistent repositories. Use HTTPS, managed secrets, structured logs, backups and database migrations in production.
