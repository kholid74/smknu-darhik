# Task: SMKDH E-Voting — Repository Audit & Implementation Planning

You are a senior full-stack engineer working on the existing SMK NU Darul Hikam Astro repository.

## Objective
Plan a production-ready, lightweight E-Voting module integrated into the existing Astro application. Do not rewrite the website or introduce Next.js.

## Confirmed Business Requirements
- Four organizations: OSIS, Dewan Ambalan, IPNU, IPPNU.
- Every registered student must vote for one candidate pair (chairperson and vice-chairperson) in each organization.
- One vote per student per organization per election period.
- All four organizations share one election opening and closing schedule.
- Students authenticate using NISN + a system-generated PIN.
- PINs are printed and individually distributed by the committee.
- Voting is conducted primarily on shared school Chromebooks.
- Students can resume incomplete voting after reconnecting or logging in again.
- Submitted votes are final and cannot be modified.
- Candidate results are hidden until official election closure.
- The module must support future annual elections.

## Phase 1 — Audit Only
Inspect the actual local repository:
1. Astro version, rendering mode, adapters, and deployment.
2. Existing routes, layouts, components, and styling conventions.
3. Existing Prisma schema, database configuration, and migration workflow.
4. Existing authentication, session management, middleware, RBAC, and capability checks.
5. Existing admin dashboard architecture and navigation.
6. Existing testing conventions and relevant utilities.
7. Potential risks when deploying voting alongside the public website.

Do not assume existing features based only on installed dependencies.

## Phase 2 — Technical Design
Propose:
- Database entities and relationships.
- Election lifecycle state machine.
- Student authentication and secure PIN generation/printing.
- RBAC integration with existing internal accounts.
- Anonymous ballot storage separated from voter eligibility.
- Atomic vote submission with concurrency protection.
- Safe session management for shared Chromebooks.
- Candidate, voter, and period management.
- Participation dashboard, election closure, and results.
- Server-side validation, rate limiting, CSRF protection, and audit logging.
- Tests for double voting, partial completion, and interrupted sessions.

Explicitly analyze ballot secrecy limitations from timestamps, transaction ordering, database access, and logs.

## Phase 3 — Implementation Planning
Produce:
1. Architecture Decision Record.
2. Detailed Prisma schema proposal.
3. API contract.
4. Page and component inventory.
5. File-by-file change plan based on the actual repository.
6. Incremental implementation tasks with dependencies.
7. Testing strategy and acceptance criteria.
8. Deployment, migration, backup, and rollback checklist.

## Constraints
- Preserve the existing Astro application.
- Reuse existing authentication and RBAC for administrators where appropriate.
- Keep student voting authentication isolated.
- Prefer existing dependencies and conventions.
- Avoid unnecessary frameworks or infrastructure.
- Prioritize data integrity and ballot secrecy.
- Do not introduce mock security controls for production.
- Do not log NISN, PIN, or candidate choices unnecessarily.
- Follow existing repository instructions in AGENTS.md and related project documentation.
- Do not modify application code during this audit.

## Deliverables
Write documentation under `docs/e-voting/` using clear Markdown files.

After completing the audit and plan, summarize findings, unresolved decisions, technical risks, and recommended implementation order.

Stop and request approval before starting implementation.
