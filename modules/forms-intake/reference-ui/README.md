# Forms & Intake Reference UI

Reference UI is optional host-app code. The module owns form schemas, validation, submissions, and intake events.

Admin surface:
- Build forms, publish forms, review submissions, and export approved response data.
- Gate reads with `forms-intake.read`; gate publish and review mutations with `forms-intake.write`.

Visitor surface:
- Render public forms, validate input, submit responses, and attach files through `file-media` when installed.
- Use the visitor feature key `forms`.

Agentic surface:
- Require approval before publishing forms, rejecting submissions, exporting data, or changing validation rules.
