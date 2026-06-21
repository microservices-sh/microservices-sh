# Project Progress Use Cases

Framework-neutral use cases are exposed from `src/service/index.ts`.

Implemented use cases:

- `createProject`
- `updateProjectStatus`
- `grantProjectAccess`
- `revokeProjectAccess`
- `createProgressLog`
- `attachProgressMedia`
- `addProjectComment`
- `getProjectSnapshot`
- `resolvePublicProject`
- `listProjects`

Do not import SvelteKit, Hono, provider clients, secret values, QR libraries, or storage clients directly in use cases. Add those in route adapters or companion modules.
