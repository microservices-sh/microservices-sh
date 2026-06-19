# Passkey Auth Reference UI

These files are installable examples for host apps. They are not required runtime code.

Reference flows:

- **Visitor (login):** call `beginAuthentication`, run `navigator.credentials.get()`
  in the browser, post the assertion to `verifyAuthentication`. On success the host
  app receives the verified `userId` and **creates its own session** (this module does
  not mint one).
- **Admin / settings (manage):** session-gated `beginRegistration` →
  `navigator.credentials.create()` → `verifyRegistration`; plus `listCredentials` and
  `deleteCredential`.

Keep reference UI thin: parse route state, call module use-cases, and let the host app
own layout, branding, navigation, and session creation.
