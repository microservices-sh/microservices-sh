export type CodeMemoryHookName =
  | "beforeTrustedSourceAdd"
  | "beforeLogicCapsuleCreate"
  | "afterLogicCapsuleRetrieved";

export interface CodeMemoryHooks {
  beforeTrustedSourceAdd?: unknown;
  beforeLogicCapsuleCreate?: unknown;
  afterLogicCapsuleRetrieved?: unknown;
}
