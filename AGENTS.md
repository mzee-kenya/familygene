# FamilyGene development rules

- Keep changes focused, typed, and consistent with existing project patterns.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` after relevant changes.
- Keep secrets in local environment files; never commit credentials or personal data.
- Treat family and health-related information as sensitive. Do not add analytics or external
  data sharing without explicit product and privacy review.
- Clearly distinguish user-provided information from verified records. Do not present generated
  family or health information as clinically validated.
- Follow `docs/clinical-requirements.md` for clinical safety boundaries.
- Do not add product features beyond the task's requested scope.
