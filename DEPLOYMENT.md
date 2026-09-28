# Deployment Setup

This project uses Expo Router with a static web export, Firebase Hosting, Firebase Functions, Firebase Authentication, and Cloud Firestore. It is not a Next.js server deployment, so Hosting serves the generated static files from `dist`.

## Prerequisites

- Node.js 22.13.x or newer for Expo SDK 57 and the Functions package
- npm
- Firebase CLI
- Access to the `orderinventory-dc522` Firebase project
- A Firebase project with Authentication, Firestore, Hosting, and Functions enabled

Check the tools:

```bash
node --version
npm --version
firebase --version
```

Authenticate and select the project:

```bash
firebase login
firebase use orderinventory-dc522
```

The project alias is stored in `.firebaserc`.

## Firebase Hosting

[firebase.json](firebase.json) configures Hosting to serve the Expo web export from `dist`:

```text
firebase.json
  hosting.public = dist
```

Expo Router generates static route output for the web build. The Hosting rewrite sends unknown paths to `/index.html` so client-side navigation can resolve routes in the browser. The app should still be built with the same route configuration used locally.

Do not run Hosting deployment before creating the `dist` directory.

## Production web build

Install root dependencies and create the production Expo web export:

```bash
npm install
npx expo export --platform web
```

The command generates `dist/`. Inspect the generated output locally before deployment. A local preview can be served with any static file server, for example:

```bash
npx serve dist
```

The Firebase Hosting configuration does not run the Expo build for you. Build first, then deploy.

## Functions build and deployment

Functions are located under `functions/` and use Firebase Functions v2 with Node.js 22.

Install the isolated Functions dependencies:

```bash
npm install --prefix functions
```

Run the Functions package checks:

```bash
npm run --prefix functions lint
```

Deploy only Functions:

```bash
firebase deploy --only functions
```

Deploy one callable function when iterating:

```bash
firebase deploy --only functions:sendInventoryEmail
firebase deploy --only functions:generateJoinCodeServer
firebase deploy --only functions:validateJoinCodeServer
```

The Functions source package must be deployed from the repository root so the Firebase CLI can read `firebase.json` and `.firebaserc`.

## Firestore deployment

The manifest points Firestore at [firestore.rules](firestore.rules) and [firestore.indexes.json](firestore.indexes.json).

Deploy rules and indexes:

```bash
firebase deploy --only firestore
```

Rules are deny-by-default and make company creation, membership changes, join-code operations, and audit writes server-only. Deploy the Functions that perform those operations before testing those workflows in production.

## Hosting deployment

After building the web application:

```bash
firebase deploy --only hosting
```

The deployed Hosting URL is printed by the Firebase CLI. Confirm login, signup, company setup, inventory navigation, and route refresh behavior after deployment.

## Deploy Hosting and Functions together

Build the Expo web application, then deploy Hosting, Functions, and Firestore together:

```bash
npm install
npx expo export --platform web
npm install --prefix functions
firebase deploy --only hosting,functions,firestore
```

This command does not deploy Authentication configuration or Storage configuration because those services are not defined in the current Firebase manifest.

## Production environment variables

### Client Firebase variables

Firebase Hosting serves static files. It does not inject `NEXT_PUBLIC_` variables into an already-built JavaScript bundle at request time. Set the client variables before running the Expo production export:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

For this Expo application, `EXPO_PUBLIC_` names are also supported by the client initializer. Use one naming convention consistently in the build environment. The values are public Firebase web configuration and may be visible in the browser bundle. They are not authorization secrets.

Typical CI setup:

1. Add the six client variables to the CI/CD environment.
2. Run `npx expo export --platform web` in that environment.
3. Deploy the resulting `dist` directory with `firebase deploy --only hosting`.
4. Never place private service-account values in these variables.

There is no separate Firebase Hosting runtime-variable command for a static Expo bundle. Changing a client variable requires a new web build and Hosting deployment.

### Functions variables and secrets

For local development, copy [functions/.env.example](functions/.env.example) to `functions/.env` and fill in development values. The file is ignored by Git.

For deployed Functions, configure server-only values through Firebase-managed configuration or the Firebase Console:

```text
Firebase Console
  -> Build
  -> Functions
  -> Environment variables
```

The legacy CLI configuration form documented for this project is:

```bash
firebase functions:config:set \
  email.provider_api_key="replace-with-email-provider-key" \
  email.from_address="inventory@your-domain.example" \
  app.join_code_expiration_hours="168" \
  app.audit_log_retention_days="365"
```

PowerShell one-line form:

```powershell
firebase functions:config:set email.provider_api_key="replace-with-email-provider-key" email.from_address="inventory@your-domain.example" app.join_code_expiration_hours="168" app.audit_log_retention_days="365"
```

Use separate development, staging, and production values. Do not put Functions secrets in `dist`, `.env.local`, Expo public variables, or client code.

## Verify configuration after deployment

Verify the selected project:

```bash
firebase use
firebase projects:list
```

Verify deployed Functions:

```bash
firebase functions:list
```

Verify the configured Functions values without committing them:

```bash
firebase functions:config:get
```

Treat terminal output from `functions:config:get` as sensitive.

Verify Hosting output:

```bash
firebase hosting:sites:list
```

Then open the deployed Hosting URL and test:

- Firebase login
- Signup and password validation
- Company creation
- Admin membership
- Join-code generation and validation
- Inventory import, edit, and export
- Admin history access
- Unauthorized route redirects
- Inventory submission placeholder behavior

## Deployment checklist

- [ ] Confirm Node.js 22.13.x or newer.
- [ ] Run `npm install` at the repository root.
- [ ] Run `npm install --prefix functions`.
- [ ] Set production client Firebase variables before the web build.
- [ ] Verify client variables contain no private keys or provider secrets.
- [ ] Set server-only Functions variables in the Functions environment.
- [ ] Build the web export with `npx expo export --platform web`.
- [ ] Confirm `dist/` exists and contains the production web output.
- [ ] Deploy Firestore rules and indexes with `firebase deploy --only firestore`.
- [ ] Deploy Cloud Functions with `firebase deploy --only functions`.
- [ ] Deploy Firebase Hosting with `firebase deploy --only hosting`.
- [ ] Or run `firebase deploy --only hosting,functions,firestore` after the build.
- [ ] Verify deployed Functions with `firebase functions:list`.
- [ ] Test the deployed Hosting URL.
- [ ] Verify no private key, service account, email API key, or token is present in the client bundle.
- [ ] Confirm audit writes remain server-side only.
- [ ] Confirm members cannot read join-code documents.
- [ ] Confirm cross-company inventory access is denied.

## Troubleshooting

### Firebase says the directory is invalid

Run deployment commands from the repository root, the directory containing `firebase.json` and `.firebaserc`.

### Hosting deploy says `dist` does not exist

Run:

```bash
npx expo export --platform web
```

Then repeat the Hosting deploy.

### Functions deploy returns HTTP 401

Authenticate again and select the project:

```bash
firebase login
firebase use orderinventory-dc522
```

### Client configuration changes do not appear

Static Hosting serves the previously built bundle. Set the variables again, rebuild `dist`, and redeploy Hosting.

### A Function cannot read its environment values

Confirm the variables were configured in the deployed Functions environment, then redeploy the affected Functions. Local `.env` files do not automatically configure an already deployed environment.
