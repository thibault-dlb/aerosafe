# Project terms

English summary of specifications §V and §VII.3. None of it appears in the [project sheet](../Fiche_projet_AeroSafe_IPSA.pdf), which says nothing about intellectual property, confidentiality, regulation or penalties. Treat it as unconfirmed until the supervising teacher states that these terms apply.

The two parties are the sponsor (IPSA, represented by the supervising teacher) and the project group.

## Intellectual property

- The source code, documentation and all deliverables remain the intellectual property of the project group members who wrote them.
- IPSA has a non-exclusive right to use the deliverables for teaching: evaluation, archiving, and illustration for later cohorts.
- Aeronautical data comes from the OpenSky Network and stays subject to its terms of use. The group checks and respects them, especially for any use beyond educational, non-commercial purposes.
- Third-party libraries and components stay under their own licences. The group keeps the list of [dependencies and licences](dependencies.md) up to date.
- Any reused external code is declared and attributed. Plagiarism is excluded and is grounds for rejecting a deliverable.

## Confidentiality

- The project relies on open data. No classified or sensitive aviation security data is processed.
- Personal data is limited to application user accounts: identifier, email address, password hash and role. It is not shared or used for anything other than running the application.
- Technical secrets (database credentials, API keys, environment variables) are never committed. They are managed through an environment file excluded from version control.
- Group members do not publicly share project elements before the supervising teacher has validated them.

**Repository visibility:** the repository has been private since 2026-11-02. Public sharing has not been validated by the supervising teacher, and the repository must stay accessible to them (§VIII.2).

## Regulatory constraints

- **Data source terms:** use of OpenSky Network data must comply with its published terms, particularly regarding the project's non-commercial, educational nature. Status: `TBD`, not checked yet.
- **Personal data:** account data is processed in line with the GDPR: purpose limited to running the application, data minimisation, secure storage and the ability to delete an account.
- **Third-party licences:** only libraries whose licence allows educational use and redistribution of the source code are used, and they are documented.
- **Institution rules:** the project follows IPSA's internal regulations and IT charter, and the rules on academic integrity.
- **No operational scope:** AeroSafe is not a certified air traffic surveillance or management system. This limitation is stated explicitly in the documentation and in the interface.

## Penalties

| Breach | Consequence |
| --- | --- |
| Late submission of a deliverable | The lateness scale set by the supervising teacher applies; past a significant delay, the deliverable may be considered not submitted |
| Deliverable incomplete against the scope | Evaluation in proportion to the priority E requirements actually covered |
| Application not working at the demonstration | Acceptance cannot be validated; a resit is at the supervising teacher's discretion |
| No version management or contribution traceability | The Software Engineering and DevOps aspects are not validated |
| Undeclared reuse of third-party work | The deliverable is rejected and the institution's regulations apply |
