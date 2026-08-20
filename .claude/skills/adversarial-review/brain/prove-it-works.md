# prove-it-works

**A claim that something works requires evidence from the surface the user touches.**

Evidence from an adjacent surface is not evidence. A green test proves the test passed.
Whether it proves the feature works depends entirely on what the test mocked.

## Why

Three incidents in this codebase, all the same shape — the verification surface and the
user surface were different, and the gap is exactly where the bug lived.

1. **The focus trap.** A bug made the composer unusable: one keystroke stole focus, so you
   could not type a second character. It shipped with 239 tests passing, because
   `PostModal.test.tsx` mocks `useFocusTrap` — the hook containing the bug.

2. **The keyboard collapse.** Four separate CSS rules each subtracted or added the iOS
   keyboard height to the same modal, collapsing the composer's text area to zero height
   when the keyboard opened. No test could catch it: `initCapacitor()` returns early off
   native, so `--keyboard-inset` is permanently `0px` in jsdom and in `npm run dev`. The
   bug is only reachable on a physical iOS surface.

3. **The silent export.** The data-export button called `<a download>`, which is a no-op
   inside a Capacitor WKWebView. No file, no picker, no error — and the app reported
   success. Every web-side check passed.

## How to apply

- Name the surface the claim is about. "Works" is not a claim; "works in the iOS app with
  the keyboard raised" is.
- Ask what the test replaced. If the mock covers the mechanism under test, the test proves
  nothing about that mechanism.
- Native-only code paths (`Capacitor.isNativePlatform()`, `env(safe-area-inset-*)`,
  `--keyboard-inset`, WKWebView behavior) cannot be verified in jsdom or a desktop
  browser. Simulator or device, or the claim is unverified.
- Schema claims are verified by querying production, not by reading `supabase/migrations/`.
  Migrations here are applied by hand and the history table holds 1 row of 40+; a migration
  file is a wish, not a fact. A `status_message` column that existed only in a migration
  file broke profile editing for every user in production.
- Show the evidence. A screenshot, a query result, a log line. "I verified it" is a claim
  about a claim.

## Filing against it

File when the author asserts a user-facing behavior works and the only evidence is a layer
that cannot observe it — a passing test that mocks the mechanism, a browser check for
native behavior, a migration file standing in for the database.

Do not file merely because tests exist and you would have written different ones. The
finding is "this evidence cannot support this claim," not "more tests please."
