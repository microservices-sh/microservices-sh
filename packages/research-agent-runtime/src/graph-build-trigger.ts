// In-process trigger for the on-box graph-build job. One machine = one client,
// so a single in-memory state is enough. The spawn is injected so the trigger
// logic is testable without a real child process.
export type BuildStatus = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  tail: string;
};

// Kicks off the build; calls back when it finishes with (ok, log tail).
export type SpawnBuild = (onDone: (ok: boolean, tail: string) => void) => void;
export type Clock = () => string;

export function createBuildTrigger(spawn: SpawnBuild, now: Clock) {
  let status: BuildStatus = {
    running: false,
    startedAt: null,
    finishedAt: null,
    ok: null,
    tail: ""
  };
  return {
    status: (): BuildStatus => status,
    // Returns false if a build is already in flight (caller maps that to 409).
    start(): boolean {
      if (status.running) return false;
      status = { running: true, startedAt: now(), finishedAt: null, ok: null, tail: "" };
      spawn((ok, tail) => {
        status = { running: false, startedAt: status.startedAt, finishedAt: now(), ok, tail };
      });
      return true;
    }
  };
}
