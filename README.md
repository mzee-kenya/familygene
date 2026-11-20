# FamilyGene

FamilyGene is a prototype workspace for exploring family-history information. This repository
contains a React and TypeScript web app, an Express API, a shared TypeScript package, and local
SQLite persistence.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- Git

## Install and run

From the repository root, install workspace dependencies and start both applications:

```powershell
npm install
npm run dev
```

The web app is available at <http://localhost:5173>. The API listens at
<http://localhost:3001>; its health endpoint is <http://localhost:3001/api/health>.

The SQLite database is created locally at `apps/api/data/familygene.sqlite` when the API starts.
Local environment values can be overridden in `apps/api/.env` and `apps/web/.env`; see each
application's `.env.example`. The local prototype seeds fictional dashboard records into an empty
development database. Set `SEED_DEMO_DATA=false` to opt out. Demo consent is not granted by
default; those seeded records cannot receive relatives until consent is explicitly updated.

## Patient and family-history API

- `GET /api/patients?q=...` — list/search records.
- `POST /api/patients` — create a patient, initial consent record, optional clinical note, and
  registration history entry. An `Idempotency-Key` header prevents duplicate record creation for
  retries.
- `GET /api/patients/:patientId` — retrieve patient, consent, relatives, conditions, notes, missing
  information, and update history.
- `PUT /api/patients/:patientId/consent` — record or update explicit consent.
- `POST /api/patients/:patientId/relatives` and
  `PUT /api/patients/:patientId/relatives/:relativeId` — create/update biological relatives and
  their associated conditions.
- `DELETE /api/patients/:patientId/relatives/:relativeId` — remove a relative.
- `POST /api/patients/:patientId/notes` — append a clinical note.
- `GET /api/patients/conditions` — retrieve the condition catalog.

API validation errors use `{ "error": { "code", "message", "fields" } }`. Family-history writes
require explicit permission recorded with consent. The interface asks for confirmation before
deleting a relative; the API deletion itself is immediate.

## Quality checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Public static demo

The GitHub Pages deployment is a read-only static showcase at
<https://mzee-kenya.github.io/familygene/>. It uses synthetic sample records and does not connect
to the Express API or persist patient registration, consent, relatives, or clinical notes. Use the
local `npm run dev` setup for the full prototype workflow. Do not enter real patient information.

The API development server loads its environment from `apps/api/.env` if present. Defaults are
provided for local development, so copying the example files is optional.

## Project layout

- `apps/web` — Vite, React, TypeScript, Bootstrap, and client-side routing.
- `apps/api` — Express API, patient/family-history endpoints, validation, versioned SQLite schema,
  and integration tests.
- `packages/shared` — shared TypeScript contracts.
- `docs` — architecture notes and clinical safety boundaries.
