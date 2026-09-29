# Firebase setup

## 1. Create the project

1. Go to https://console.firebase.google.com and create a project (Google Analytics is not needed).
2. **Build → Authentication → Get started**, enable **Email/Password**. Only admins ever sign in, so do not enable self-service sign-up flows anywhere else.
3. **Build → Firestore Database → Create database**. Pick production mode and a region near your users. For South Africa, `africa-south1` (Johannesburg) is available in newer projects; otherwise `europe-west1` is the closest common choice.
4. **Build → Storage → Get started**, same region. Storage may require the Blaze (pay-as-you-go) plan. Releases are large files, so check the pricing.
5. **Project settings → Your apps → Add web app**. Copy the config into the `NEXT_PUBLIC_FIREBASE_*` variables.

## 2. Service account (server access)

Project settings → **Service accounts → Generate new private key**. From the downloaded JSON:

- `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
- `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
- `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (wrap in double quotes; keep the `\n` sequences)

This key can read and write everything, bypassing the security rules. Store it only in `.env.local` and Vercel's environment variables. Delete the downloaded file afterwards.

## 3. Deploy the security rules

```bash
firebase login
firebase use --add            # choose your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

What the rules enforce:

| Data | Who can do what |
|---|---|
| Published releases, pricing, public contact details | Anyone can read |
| Contact-form messages | Anyone can create one (size and shape checked); only admins read |
| Customers, subscriptions, invoices, payments, terminals, notifications, settings | Admins only |
| Licences | Admins read; **only the server writes** (so keys can't be forged from a browser) |
| Audit log | Admins read and append; nobody can edit or delete |
| Release files in Storage | **Private.** Only admins can read, upload or delete (max 2 GiB per file). Visitors never touch Storage directly; the site hands them a signed link that expires in five minutes |
| Download statistics, private share links | Admins read; only the server writes |
| Link addresses of externally hosted files (`releaseLinks`) | **No browser access at all**, not even admins. Only server code reads them |

"Admin" means a Firebase user with the custom claim `admin: true`, set by `npm run admin:grant`. The claim is checked by the rules, not just the UI, so hiding a button is never the only protection.

Storage is now fully private, so the storage rules no longer look anything up in Firestore. Signed download links are created by the server using your service account, which is why `FIREBASE_ADMIN_*` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` must both be set.

## 4. Admin users

```bash
npm run admin:grant -- someone@example.com            # add
npm run admin:grant -- someone@example.com --revoke   # remove
```

The person must exist in Authentication first, and must sign out and back in for the claim to take effect. Grant this to as few people as possible.

## 5. Authorized domains

Authentication → Settings → **Authorized domains**: add your production domain (and your Vercel preview domain if you use previews).

## 6. Backups

Firestore holds the business's billing history. Enable scheduled backups (Firestore → Disaster recovery) or export periodically with `gcloud firestore export`.
