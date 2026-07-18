# Soccer Stats Security Checklist

Last updated: 2026-07-17

This document records the security checks performed before distributing Soccer Stats builds and defines the checklist that must be repeated before every new APK, release candidate, or production deployment. Keep it updated whenever the architecture, permissions, authentication model, upload flow, hosting provider, or release process changes.

## Current Architecture

- Frontend: React + Vite packaged with Capacitor for Android.
- Backend: Express, Drizzle ORM, PostgreSQL/Neon-compatible database.
- Authentication: server-side sessions stored in PostgreSQL in production.
- Authorization: role-based permissions for admin, tournament manager, team captain, referee, and public users.
- Hosting: Render web service.
- Native notifications: Capacitor Local Notifications.
- Media: Cloudinary signed image uploads for match highlight thumbnails.
- Twitch: server-side app access token flow when Twitch credentials are configured.

Not currently used:

- Flutter.
- Supabase/RLS.
- Firebase.
- OpenRouter.
- Client-side service-role keys.

If any of these are introduced later, this checklist must be expanded before the feature is released.

## Verification Log

These checks were performed for this baseline:

- Checked that `.env`, Android keystores, signing properties, and Google service files are not tracked by Git.
- Searched the repository for credential-like strings, including API keys, secrets, tokens, passwords, OAuth secrets, SMTP, Mailgun, Resend, Supabase, Cloudinary, Twitch, and OpenRouter references.
- Reviewed `.env.example` to confirm it contains placeholders rather than real secrets.
- Reviewed `render.yaml` to confirm sensitive Render variables are marked `sync: false` or generated.
- Reviewed backend security controls in `server/index.ts`, `server/routes.ts`, `server/auth.ts`, and `server/storage.ts`.
- Reviewed Android permissions and release configuration in `android/app/src/main/AndroidManifest.xml` and `android/app/build.gradle`.
- Reviewed client API configuration in `client/src/lib/api.ts` and Capacitor configuration.
- Reviewed Cloudinary thumbnail signing flow for match highlights.
- Reviewed Twitch integration to confirm sensitive token exchange runs on the backend.
- Ran `npm audit --omit=dev --json`: no production dependency vulnerabilities reported at this baseline.
- Ran `npm run check`, `npm test`, `npm run build`, and `npm run apk:debug` during the latest implementation cycle before this document was created.

## Security Decisions

### Secrets

- Secrets must live only in environment variables or local untracked files.
- `.env`, `android/signing.properties`, `*.jks`, and `*.keystore` are gitignored.
- Render secrets such as `DATABASE_URL`, email credentials, OAuth refresh tokens, and notification emails must stay `sync: false`.
- `SESSION_SECRET` is required in production and must be at least 32 characters.
- Android builds may include `VITE_API_BASE` because it is a public API URL, not a secret.

### Authentication And Sessions

- Production uses PostgreSQL-backed sessions, not memory sessions.
- Session cookies are `httpOnly`.
- Secure cookies are required in production unless `COOKIE_SECURE=false` is explicitly set for a controlled non-HTTPS environment.
- Login and registration endpoints have rate limiting.
- Passwords are hashed with scrypt and older hashes are rehashed after successful login.

### Authorization

- Backend permissions are enforced server-side with role checks.
- Public access is read-only for allowed public resources.
- Admin-only endpoints remain protected by admin role checks.
- Tournament managers may only manage tournaments they created.
- Registration review is scoped so tournament managers only review requests for their own tournaments.
- Team captains are limited to their own team context where applicable.

### Data Validation

- Request payloads are validated with Zod schemas before storage.
- IDs are converted to numbers and checked before sensitive operations.
- Tournament/team registration checks validate tournament type and ownership rules.
- Spreadsheet imports cap team/player counts.
- Twitch channel values are normalized and validated.

### Media Uploads

- Cloudinary API secret stays on the backend.
- The client receives a short-lived signed upload payload, not the API secret.
- Thumbnail uploads are restricted to images on the client.
- Server-side highlight validation checks file size metadata, Cloudinary host, match/team/player consistency, and maximum match minute.
- Remaining risk: the thumbnail signature endpoint is protected by session/role checks but does not currently have a dedicated rate limiter.

### Twitch And External APIs

- Twitch client secret is read only from backend environment variables.
- Twitch token exchange happens on the backend.
- Twitch stream status is queried server-side.
- Twitch embeds and public Twitch channel names can appear in the client by design.

### Android Permissions

Current permissions:

- `INTERNET`: required for API calls, Twitch embeds, and remote assets.
- `POST_NOTIFICATIONS`: required on Android 13+ for app notifications.
- `SCHEDULE_EXACT_ALARM`: used so scheduled match reminders can be delivered more accurately.

Current Android components:

- Main activity is exported because it is the launcher activity.
- FileProvider is not exported and grants URI permissions only as needed.

### Release Builds

- Release signing properties are kept outside the repository.
- Release builds fail if signing properties are missing.
- Current residual risk: `minifyEnabled false` in release. Enable and test R8/minification before publishing broadly or submitting to Google Play.
- Debug APKs are acceptable only for internal development/testing groups that understand the risk. Wider tester distribution should use signed release APK/AAB.

### Logging And Errors

- Backend logs basic request information and migration status.
- Sensitive values must never be logged.
- Current residual risk: some client/server diagnostic logs remain. Before public distribution, verify that no sensitive payloads, tokens, credentials, or stack traces are exposed to users.

## Findings

### Critical

- No tracked private secrets were found in the baseline checks.
- No production dependency vulnerabilities were reported by `npm audit --omit=dev`.

### Medium

- Release minification is disabled (`minifyEnabled false`). This increases reverse-engineering readability.
- Debug build scripts and documentation exist. They are useful for development but debug APKs should not be treated as production-ready.
- Cloudinary upload signing is protected by authorization, but there is no endpoint-specific rate limit for thumbnail signatures.

### Minor

- Documentation contains local development URLs such as `localhost`, `127.0.0.1`, and `10.0.2.2`. These are acceptable in docs but should not be used in release builds.
- `render.yaml` allows `https://localhost` and `capacitor://localhost` origins. This is expected for Capacitor, but review it before web publication under a public domain.
- Android `allowBackup` is currently true. Review whether app backup should be disabled before production distribution if cached app data becomes sensitive.

## Security Score

Current score: 84/100.

Rationale:

- Secrets handling: 18/20. No tracked private secrets found; Render sensitive values are not synced. Continue rotating any credentials ever pasted into chat/tools.
- Authentication/session handling: 17/20. Strong password hashing, production session store, cookie protections, and rate limits are present.
- Authorization: 18/20. Role and tournament ownership checks are enforced server-side. Continue adding regression tests for every new role-sensitive endpoint.
- Input validation: 17/20. Zod validation and explicit entity checks are broadly used.
- Android/release readiness: 11/20. Permissions are explainable and release signing is protected, but release minification is disabled and debug APK distribution remains a residual risk.
- Dependency posture: 3/3. Production audit currently reports no vulnerabilities.

## Pre-Release Checklist

Run this before every APK, AAB, release candidate, or production deploy.

### Repository And Secrets

- [ ] `git status --short --branch` is clean or only contains intentional release changes.
- [ ] No `.env`, keystore, signing file, service account JSON, or credential file is tracked:
  `git ls-files | Select-String -Pattern '(^|/)(\\.env|.*\\.jks|.*\\.keystore|signing\\.properties|google-services\\.json|serviceAccount|credentials)'`
- [ ] Search for credential-like strings:
  `rg -i "(api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|refresh[_-]?token|bearer|service[_-]?role)" --glob '!node_modules/**' --glob '!dist/**' --glob '!android/**/build/**'`
- [ ] Verify `.env.example` contains placeholders only.
- [ ] Verify Render variables with secrets are `sync: false` or generated.
- [ ] Rotate any credential that was pasted into chat, logs, screenshots, issues, commits, or build artifacts.

### Backend

- [ ] `NODE_ENV=production` is set in Render.
- [ ] `DATABASE_URL` is configured only in Render/local env and not committed.
- [ ] `SESSION_SECRET` exists and is at least 32 characters.
- [ ] `COOKIE_SECURE` is not disabled in HTTPS production.
- [ ] `API_ORIGINS` contains only required origins for the build being released.
- [ ] Login and registration rate limits are active.
- [ ] New endpoints use authentication/authorization middleware where needed.
- [ ] New endpoints validate body, params, and query values with Zod or equivalent checks.
- [ ] Role-sensitive behavior has tests for admin, tournament manager, team captain, referee, and public users where relevant.
- [ ] No endpoint returns passwords, hashes, tokens, session data, or private environment values.
- [ ] `/health` returns only minimal health information.

### Database And Authorization

- [ ] Migrations are additive/backward compatible or have a rollback plan.
- [ ] Admin endpoints remain admin-only unless explicitly designed otherwise.
- [ ] Tournament manager endpoints are scoped to tournaments they own.
- [ ] Team captain endpoints are scoped to their own team.
- [ ] Public endpoints are read-only and expose only intended public data.
- [ ] Soft-delete behavior does not leak deleted teams, players, matches, or tournaments to public views.

### Media And External Services

- [ ] Cloudinary API secret is backend-only.
- [ ] Cloudinary uploads use signed payloads when required.
- [ ] Upload size limits are enforced client-side and server-side.
- [ ] Upload MIME/type restrictions are enforced; executables are rejected.
- [ ] Highlight URLs are validated and restricted to supported providers.
- [ ] Twitch client secret is backend-only.
- [ ] External provider failures do not expose secrets or stack traces to users.

### Android And APK

- [ ] Build release for external testers whenever possible:
  `npm run apk:release` or an AAB release task.
- [ ] Debug APKs are used only for trusted internal testing.
- [ ] Release signing properties are outside the repo and accessible only to maintainers.
- [ ] `android/app/build.gradle` release settings are reviewed.
- [ ] R8/minification is enabled and tested before broad distribution.
- [ ] Android permissions are reviewed and documented in this file.
- [ ] `AndroidManifest.xml` contains no unnecessary permissions, exported activities, or debug-only components.
- [ ] APK/AAB does not include local databases, test users, private configs, or unused sensitive assets.
- [ ] Native build points to the intended production API URL.

### Frontend/Capacitor

- [ ] `VITE_API_BASE` points to the intended production API for native builds.
- [ ] No internal IPs or development API URLs are bundled in release assets.
- [ ] No sensitive data is stored in `localStorage`.
- [ ] Client logs do not include user data, tokens, credentials, or private URLs.
- [ ] Public views do not expose admin-only controls.
- [ ] Notification permissions and local notification behavior are tested on Android 13+.

### Dependencies And Build

- [ ] `npm ci` completes cleanly.
- [ ] `npm run check` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npm audit --omit=dev` has no high or critical vulnerabilities.
- [ ] `npm run apk:debug` passes for internal builds, or `npm run apk:release` passes for release builds.

### Deployment

- [ ] Commit is pushed to the intended branch.
- [ ] Render deploy reaches `live`.
- [ ] `/health` returns `{"status":"ok"}` after deployment.
- [ ] Smoke test login, public browsing, tournament details, registration request, and approval flow.
- [ ] Confirm no unexpected server logs or client errors after smoke testing.

## Required Follow-Ups Before Google Play

- [ ] Enable and test R8/minification for release builds.
- [ ] Decide whether to set `android:allowBackup="false"` for production.
- [ ] Add endpoint-specific rate limiting for Cloudinary thumbnail signatures.
- [ ] Add a short security regression test set for registration reviewer scoping and upload permissions.
- [ ] Review whether `API_ORIGINS` should include a public web origin if/when a web frontend is deployed separately.
- [ ] Re-run this checklist after every dependency upgrade or permission change.
