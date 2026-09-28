# OrderInventory

OrderInventory is a company-scoped inventory application for importing Excel workbooks, editing and publishing inventory, reviewing submission approvals, exporting files, and retaining activity and version history. One Expo Router codebase supports Android, iOS, and the web.

## Features

- Email/password authentication with company-based access control.
- Administrator company setup, member management, settings, and approval review.
- Secure join codes: codes are hashed at rest, expire after one minute, and expired hashes are deleted by a scheduled Firebase Function.
- Excel (`.xlsx`) import with dynamic columns and export of the current inventory.
- Shared inventory table for read and edit modes, including row selection, row/column administration, and a dedicated landscape table workspace.
- Admin publishing and member-to-admin inventory submission workflow.
- Inventory snapshots, audit history, and email submission support.
- Firebase Hosting configuration for the Expo web export.

## Stack

- Expo SDK 57, Expo Router, React 19, React Native 0.86, TypeScript
- NativeWind and Tailwind CSS
- Firebase Authentication, Cloud Firestore, Cloud Functions for Firebase (2nd Gen), and Firebase Hosting
- SheetJS (`xlsx`) for workbook processing

## Requirements

- Node.js 22.13 or newer
- npm and Git
- Firebase CLI for emulators and deployment: `npm install --global firebase-tools`
- Android Studio/emulator for Android development, or Xcode 26.4 or newer on macOS for iOS development

Verify Node.js and npm:

```bash
node --version
npm --version
```

## Setup

### 1. Install dependencies

From the repository root:

```bash
npm install
cd functions
npm install
cd ..
```

Use `npx expo install <package>` when adding Expo or React Native packages so versions remain compatible with SDK 57.

### 2. Configure Firebase

The app reads its client Firebase configuration from `.env.local`. Create this ignored local file in the repository root:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

In Firebase Console, enable Email/Password authentication and create a Firestore database. The configured project for this repository is `orderinventory-dc522`; use a separate Firebase project for development, staging, and production where appropriate.

`EXPO_PUBLIC_` values are present in the client bundle. Do not put service-account credentials, email-provider secrets, or any private credentials in this file. Configure server-only secrets through Firebase or your deployment environment.

### 3. Run locally

```bash
npm run start
```

Then select a target, or run one directly:

```bash
npm run web
npm run android
npm run ios
```

The landscape table workspace relies on `expo-screen-orientation`. Create a new Android or iOS development build after changing [app.json](app.json); an existing installed binary may not include updated orientation configuration.

## Inventory Workflow

1. An administrator creates a company and receives a one-minute join code.
2. The administrator shares the code only with an approved teammate ready to join.
3. A new user joins the company using the code. The raw code is never stored in Firestore.
4. Members import or edit inventory, then submit it for administrator approval.
5. Administrators can publish directly, manage members, and approve or reject member submissions.
6. Use **View table** to enter the compact landscape inventory workspace. It has a persistent exit control, a view/edit toggle, and publishing/submission actions.

## Security Model

- Firestore is deny-by-default through [firestore.rules](firestore.rules).
- Client requests use callable Functions for sensitive operations such as company creation, join-code validation, inventory persistence, membership administration, and audit history.
- Join-code documents retain only a SHA-256 hash, metadata, and a server-issued expiration time.
- `validateJoinCodeServer` rejects expired codes. `deleteExpiredJoinCodes` also runs every minute to remove expired join-code hashes.
- Memberships carry the company ID and role, and server functions verify active membership before processing company data.
- Audit events record inventory, joining, and administration activity.

## Commands

| Command                                  | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `npm run start`                          | Start Expo development server             |
| `npm run web`                            | Start Expo web target                     |
| `npm run android`                        | Start Android target                      |
| `npm run ios`                            | Start iOS target (macOS only)             |
| `npm run lint`                           | Run Expo linting                          |
| `npx tsc --noEmit`                       | Type-check the app                        |
| `npx expo-doctor`                        | Check Expo project health                 |
| `firebase emulators:start`               | Start configured Firebase emulators       |
| `firebase deploy --only functions`       | Deploy Cloud Functions                    |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules                    |
| `npx expo export --platform web`         | Build the web bundle into `dist`          |
| `firebase deploy --only hosting`         | Deploy the web bundle to Firebase Hosting |

## Deployment

Authenticate with the Firebase CLI and check the selected project:

```bash
firebase login
firebase use
```

Deploy the backend and rules:

```bash
firebase deploy --only functions,firestore:rules
```

Build and deploy the Expo web application:

```bash
npx expo export --platform web
firebase deploy --only hosting
```

The Hosting deployment uses `dist` and rewrites all paths to `index.html` for Expo Router routes. Native orientation configuration is part of the app binary, so build a new native binary after changing [app.json](app.json).

## iOS App Store Release

Before creating any production build, complete these release-owned values in [app.json](app.json):

1. Add `ios.bundleIdentifier` using a reverse-DNS identifier registered to your Apple Developer account, such as `com.yourcompany.orderinventory`. Expo otherwise generates `com.placeholder.appid`, which cannot be submitted.
2. Replace `support@orderinventory.example` in [src/app/account-delete.tsx](src/app/account-delete.tsx) with a monitored support address. Test that the deletion-request action opens a usable email composer on an iPhone.
3. Deploy the web application and publish its direct `/privacy` and `/account-delete` URLs in App Store Connect. Confirm both pages are accessible without an app login and that the privacy page names the real support contact.

The project is configured with an iOS build number, an App Store encryption declaration for standard exempt encryption, a camera usage string for barcode scanning, and EAS build profiles in [eas.json](eas.json). `requireFullScreen` remains enabled because the inventory table uses runtime orientation locking.

Install and authenticate EAS CLI, then create a TestFlight build after completing the prerequisites:

```bash
npm install --global eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

In App Store Connect, accurately complete the App Privacy questionnaire for account identity data, user/company inventory content, and camera access for barcode scanning. Declare tracking only if the released app actually tracks users. Before submission, test the release build on an iPhone and iPad: sign-in, invitation join, import/export, barcode permission and scan flows, landscape table workspace, profile credential changes, and account-deletion request.

## Project Layout

```text
src/app/                 Expo Router screens
src/components/          Reusable UI and inventory table components
services/                Firebase-backed client services
firebase/                Firebase client initialization and auth helpers
functions/src/           Callable Functions and scheduled cleanup tasks
assets/                  Application artwork and icons
firestore.rules          Firestore access policy
firebase.json            Functions, Firestore, and Hosting configuration
```

## References

- [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/)
- [Expo ScreenOrientation documentation](https://docs.expo.dev/versions/v57.0.0/sdk/screen-orientation/)
- [Firebase Authentication documentation](https://firebase.google.com/docs/auth)
- [Cloud Firestore security rules documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions for Firebase documentation](https://firebase.google.com/docs/functions)
- [SheetJS documentation](https://docs.sheetjs.com/)
#   O r d e r I n v e n t o r y  
 