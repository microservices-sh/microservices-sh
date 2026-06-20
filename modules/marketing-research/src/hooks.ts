import type { MarketingBrief, Signal } from "./types";

export interface BeforeMarketingResearchRunHookInput {
  actorId: string;
  topic: string;
  channels: string[];
}

export interface AfterMarketingBriefCreatedHookInput {
  brief: MarketingBrief;
  signals: Signal[];
}

export interface MarketingResearchHooks {
  beforeResearchRun?: (input: BeforeMarketingResearchRunHookInput) => Promise<void> | void;
  afterBriefCreated?: (input: AfterMarketingBriefCreatedHookInput) => Promise<void> | void;
}
