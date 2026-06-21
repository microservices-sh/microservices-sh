export const videoGenerationEvents = {
  "emitted": [
    "video-generation.created",
    "video-generation.updated",
    "video-generation.job.created",
    "video-generation.job.submitted",
    "video-generation.job.processing",
    "video-generation.job.completed",
    "video-generation.job.failed",
    "video-generation.job.cancelled",
    "video-generation.output.attached"
  ],
  "consumed": []
} as const;
