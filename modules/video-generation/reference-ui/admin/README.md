# Video Generation Admin Reference UI

Expected admin surfaces:

- Generation job list filtered by status, owner, provider, and created date.
- Job detail with prompt, parameters, provider task id, status, progress, error, references, and outputs.
- Manual provider status refresh action when route adapters support polling.
- Output finalization view showing provider URLs and app-owned storage keys.

Permissions:

- `video-generation.read` for job/output views.
- `video-generation.write` for submit, status reconciliation, cancellation, and output attachment.
- `video-generation.admin` for provider setup and destructive cleanup workflows.
