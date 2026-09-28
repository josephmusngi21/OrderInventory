# Environment and Secrets Setup

This project has two configuration surfaces:

- The Expo client, which needs public Firebase web-application settings.
- Firebase Functions, which needs server-only email and operational settings.

The templates are [`.env.local.example`](.env.local.example) and [`functions/.env.example`](functions/.env.example). Copy them locally and replace placeholders. Never commit the copied files.

## Client configuration

Create `.env.local` in the repository root:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

These `NEXT_PUBLIC_` names are safe for client use because Firebase web configuration identifies the Firebase project; they are not service-account credentials. They do not bypass Firebase Authentication or Firestore Rules.

This repository is currently an Expo application rather than a Next.js application. Expo client configuration is commonly exposed through `EXPO_PUBLIC_` variables, while the requested `NEXT_PUBLIC_` layout is retained as the documented web-compatible structure. The Firebase client initialization must be updated in a later implementation step to read the chosen client variable names instead of keeping values in source.

Do not put any of the following in `.env.local` or any client bundle:

- Firebase Admin service-account JSON
- Private keys
- Email provider API keys
- OAuth client secrets
- Database administrator credentials
- Signing keys or tokens

## Functions configuration

Create `functions/.env` for local Functions Emulator use from the template:

```text
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM_ADDRESS=inventory@your-domain.example
JOIN_CODE_EXPIRATION_HOURS=168
AUDIT_LOG_RETENTION_DAYS=365
```

These values are server-only. Functions should read them through the Functions runtime environment, for example through `process.env` in the Functions implementation. The client must never import or receive these values.

Recommended meanings:

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER_API_KEY` | Placeholder API credential for the eventual email provider |
| `EMAIL_FROM_ADDRESS` | Verified sender address used for inventory submissions |
| `JOIN_CODE_EXPIRATION_HOURS` | Optional lifetime for newly generated join codes; `168` is seven days |
| `AUDIT_LOG_RETENTION_DAYS` | Operational retention target for audit data; `365` is one year |

## Firebase CLI configuration

The legacy Functions config command requested for this project is:

```bash
firebase functions:config:set \
  email.provider_api_key="replace-with-email-provider-key" \
  email.from_address="inventory@your-domain.example" \
  app.join_code_expiration_hours="168" \
  app.audit_log_retention_days="365"
```

On Windows PowerShell, use one line or PowerShell backticks for continuation:

```powershell
firebase functions:config:set email.provider_api_key="replace-with-email-provider-key" app.join_code_expiration_hours="168" app.audit_log_retention_days="365"
```

Inspect the configured values without exposing them in source control:

```bash
firebase functions:config:get
```

Treat command history and terminal output as sensitive when real provider credentials are used.

For the Functions runtime environment, the Firebase Console path is:

```text
Firebase Console
  -> Build
  -> Functions
  -> Environment variables
```

Add the same server-only keys there for the deployed environment. Use separate values for development, staging, and production.

## Local development

1. Copy `.env.local.example` to `.env.local`.
2. Copy `functions/.env.example` to `functions/.env`.
3. Replace placeholders with development-project values.
4. Keep local files untracked; `.gitignore` excludes them.
5. Restart Expo after changing client variables.
6. Restart the Functions Emulator after changing Functions variables.
7. Use a development Firebase project and test email provider account.

Do not paste real secrets into source files, pull requests, issue reports, screenshots, or chat logs.

## Production

- Store production values in Firebase-managed environment configuration or an approved secret manager.
- Use a separate Firebase project from development.
- Restrict access to production secrets to the deployment and operations teams.
- Rotate email provider keys periodically and after any suspected exposure.
- Use a verified sender domain and address.
- Keep Firebase App Check, Authentication, and Firestore Rules enabled as independent controls.
- Deploy Functions after setting production configuration, then verify a test submission.
- Do not rely on obscurity: `NEXT_PUBLIC_` and `EXPO_PUBLIC_` values can be inspected by users.

## How values are loaded

Client configuration is loaded by the client Firebase initializer during the app build/runtime process. Any client-visible variable can be included in the JavaScript bundle and must therefore be treated as public project configuration.

Functions configuration is loaded only inside the Cloud Functions runtime. Function code reads server-side values from the runtime environment and uses them for provider calls or operational defaults. A callable response must never return an API key, private key, or raw provider configuration.

The Firebase Admin SDK uses the deployed Functions service identity. Admin credentials are supplied by the Firebase runtime and must not be copied into this repository.

## Security notes

- `NEXT_PUBLIC_` variables are safe for client use, but they are not secrets.
- Functions environment variables and `functions:config:set` values are server-only.
- Never expose private keys in client-side code.
- Never use a client-side environment variable to authorize an admin action.
- Enforce admin/member authorization with Firebase Authentication, trusted Functions logic, and Firestore Rules.
- Join-code plaintext should be returned only at generation time; store only its hash.
- Inventory data is protected by company membership and Firestore Rules. Encrypting a visible company name is not a substitute for authorization and tenant isolation.
- If a secret is exposed, revoke and rotate it immediately.
