import type { SuggestLogicCapsulesInput, SuggestLogicCapsulesResult } from "../types";
import { suggestLogicCapsulesFromFiles as suggestRuntimeLogicCapsulesFromFiles } from "./runtime.js";

export function suggestLogicCapsulesFromFiles(input: SuggestLogicCapsulesInput): SuggestLogicCapsulesResult {
  return suggestRuntimeLogicCapsulesFromFiles(input);
}
