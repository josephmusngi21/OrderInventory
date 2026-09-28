# iOS App Store Release Checklist

## Release-owned values

- [ ] Set `expo.ios.bundleIdentifier` in `app.json` to an identifier owned by the Apple Developer team. Do not ship with Expo's generated `com.placeholder.appid`.
- [ ] Replace `support@orderinventory.example` with a monitored support address in `src/app/account-delete.tsx`.
- [ ] Deploy the Expo web export and verify the public privacy and account-deletion URLs work without authentication.
- [ ] Update the privacy policy with the production support contact, effective date, retention policy, and the jurisdictions relevant to the business.
- [ ] Enroll in the Apple Developer Program and create the matching App ID in Certificates, Identifiers & Profiles.

## Build and TestFlight

1. Run `npx expo-doctor` and `npx tsc --noEmit --pretty false`.
2. Update `expo.version` for a customer-facing release. EAS increments `ios.buildNumber` for each production build.
3. Run `eas build --platform ios --profile production`.
4. Install the resulting TestFlight build and test on physical iPhone and iPad hardware.
5. Run `eas submit --platform ios --profile production`, or upload the build through App Store Connect.

## Required Device Checks

- [ ] Email/password sign-up, sign-in, sign-out, and password/email reauthentication.
- [ ] Company creation, join-code expiration, and member approval workflows.
- [ ] Excel import, edit, publish or submission, history, and export/share.
- [ ] Barcode scanner permission prompt, denied permission state, known barcode, and new barcode item flows.
- [ ] Portrait navigation and the full-screen landscape inventory table workspace.
- [ ] Account profile update and the account-deletion request link.
- [ ] Privacy policy and terms links while signed out and signed in.

## App Store Connect

- [ ] Add the public privacy policy URL and account-deletion URL.
- [ ] Provide a support URL, marketing URL if available, review contact, and review notes explaining the test account and barcode workflow.
- [ ] Complete App Privacy responses for name, email address, company membership, inventory content, and camera access based on the released Firebase configuration.
- [ ] Answer the encryption export-compliance question consistently with `ITSAppUsesNonExemptEncryption=false`; obtain legal review if custom non-exempt encryption is added later.
- [ ] Upload App Store screenshots from real supported devices and provide a working review account or reproducible review instructions.
