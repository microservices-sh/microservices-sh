# Video Generation Visitor Reference UI

Visitor-facing templates may expose a creator form and history view, but this module does not require one.

Recommended visitor behavior:

- Create draft jobs with `createVideoJob`.
- Require approval, billing, rate-limit, and moderation checks before `submitVideoJob`.
- Poll a route adapter that calls `recordVideoProviderStatus`.
- Display app-owned output URLs after the adapter has finalized bytes through `file-media` or R2.

This module does not ship prompt UI, story editing, browser FFmpeg, payment screens, auth, or provider credentials.
