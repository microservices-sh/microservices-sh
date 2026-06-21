import type {
  ListVideoJobsInput,
  VideoGenerationJob,
  VideoGenerationOutput
} from "../types";

export interface VideoGenerationStore {
  getJob(tenantId: string, jobId: string): Promise<VideoGenerationJob | null>;
  getJobByProviderTaskId(tenantId: string, providerTaskId: string): Promise<VideoGenerationJob | null>;
  upsertJob(job: VideoGenerationJob): Promise<void>;
  listJobs(tenantId: string, input?: ListVideoJobsInput): Promise<VideoGenerationJob[]>;

  insertOutput(output: VideoGenerationOutput): Promise<void>;
  getOutputByProviderUrl(tenantId: string, jobId: string, providerUrl: string): Promise<VideoGenerationOutput | null>;
  listOutputsForJob(tenantId: string, jobId: string): Promise<VideoGenerationOutput[]>;
}
