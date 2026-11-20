# Architecture

FamilyGene is an npm-workspaces monorepo with a web client, an API, and a small shared-contracts
package.

## Applications

- **Web (`apps/web`)**: React and TypeScript served by Vite during development. React Router
  handles client-side routes; Bootstrap supplies the initial responsive styling.
- **API (`apps/api`)**: Express and TypeScript, with JSON request parsing, configurable CORS,
  structured API errors, server-side validation, health and patient/family-history endpoints.
- **Persistence**: SQLite is initialized locally by the API in `apps/api/data/`. Versioned SQL
  migrations define patients, consent, biological relatives, associated health conditions, clinical
  notes, and patient history. Patient creation and relative-condition replacement use transactions.
  The database and its records are excluded from Git. Prisma is intentionally not introduced for
  this SQLite prototype.
- **Shared (`packages/shared`)**: typed request/response contracts and clinical-data enums used by
  both applications.

## Local development

Run `npm install` once and `npm run dev` from the repository root. Vite serves the frontend on
port 5173 and proxies `/api` requests to the API on port 3001. The API only allows the configured
web origin. Both ports can be overridden using the relevant application environment variables.

The production build compiles the shared package and API before building the web app. The web
build is a static Vite bundle; API deployment and production database operations are not yet
configured.

## Patient data flow

The web client reads and writes patient records through `/api/patients`. The API validates all
client-supplied values, stores consent separately, and blocks relative writes unless permission to
collect family history is granted. Relative conditions are related through a join table. Detail
responses include sources, explicit unknowns, missing-information indicators, notes, and history
events; the application does not derive genetic diagnoses or risk scores.

The GitHub Pages static build uses `VITE_DEMO_MODE=true` and a repository path base, and is
published from the `gh-pages` branch. It uses only synthetic in-memory fixtures, makes no API
requests, and disables patient/consent/family-history writes. It is a read-only showcase, not a
hosted full-stack service.
