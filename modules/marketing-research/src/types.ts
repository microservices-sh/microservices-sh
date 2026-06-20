export type {
  Actor,
  AuditEntry,
  Citation,
  Coverage,
  DomainEvent,
  MarketingBrief,
  MarketingStore,
  MemoryMarketingStore,
  Signal,
  SocialListenPort,
  Synthesizer,
  AuditSink
} from "./index";

export interface MarketingResearchConfig {
  enabled: boolean;
  defaultChannels: string[];
  maxSignalsPerRun: number;
  requireApprovalForRun: boolean;
}
