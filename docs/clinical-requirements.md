# Clinical safety boundaries

FamilyGene is a software prototype, not a medical device or clinical decision-support system.
Nothing in this initial setup diagnoses disease, estimates an individual's medical risk, or
recommends screening, treatment, or other clinical action.

- Do not describe family-history entries as verified unless their source and verification status
  are explicit.
- Do not turn incomplete or uncertain family information into a diagnosis or personalized
  clinical recommendation.
- Clearly communicate uncertainty and direct users to a qualified healthcare professional for
  personal medical questions.
- Treat family and health information as sensitive personal data. Minimize collection, restrict
  access, and do not send it to analytics or third parties without explicit authorization and
  privacy review.
- Obtain appropriate consent before collecting or displaying another person's information.
- Do not allow family-history writes unless permission to collect and document the history has been
  explicitly recorded. Consent is not selected by default.
- Preserve the source of each relative's information (`patient-reported`, `documented`,
  `clinically verified`, or `unknown`) and display uncertainty rather than filling gaps by
  inference.
- Condition entries are descriptive only. Do not infer carrier status, genotype, inheritance
  patterns, diagnoses, screening recommendations, or unsupported risk percentages.
- Use synthetic data only in the prototype. Local SQLite records are not protected by a production
  authentication or authorization layer.
- Do not claim regulatory compliance, clinical validation, or medical accuracy without a
  documented review.
