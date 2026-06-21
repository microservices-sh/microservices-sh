import { describe, expect, it } from "vitest";
import { createVideoGenerationMemoryStore } from "./adapters/memory";
import {
  createSequentialVideoGenerationIdFactory,
  createVideoGenerationService
} from "./service";
import type {
  TenantContext,
  VideoGenerationJob,
  VideoGenerationProvider
} from "./types";

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-06-21T00:00:00.000Z"
};

function service(provider?: VideoGenerationProvider) {
  return createVideoGenerationService({
    store: createVideoGenerationMemoryStore(),
    createId: createSequentialVideoGenerationIdFactory(),
    provider,
    config: { enabled: true, defaultProvider: "kie", defaultExpiryDays: 7 }
  });
}

describe("video-generation", () => {
  it("creates draft jobs and validates prompt/reference metadata", async () => {
    const videos = service();

    const missingPrompt = await videos.createVideoJob(ctx, { prompt: " " });
    expect(missingPrompt.ok).toBe(false);
    expect(missingPrompt.error?.code).toBe("prompt_required");

    const badReference = await videos.createVideoJob(ctx, {
      prompt: "A product flythrough",
      referenceAssets: [
        { path: "../secret.png", mimeType: "image/png", sizeBytes: 10, role: "reference" }
      ]
    });
    expect(badReference.ok).toBe(false);

    const job = await videos.createVideoJob(ctx, {
      prompt: "A product flythrough",
      ownerId: "customer_1",
      model: "veo-3",
      durationSeconds: 8,
      resolution: "1080p",
      aspectRatio: "16:9",
      referenceAssets: [
        { path: "refs/hero.png", mimeType: "image/png", sizeBytes: 1024, role: "reference" }
      ]
    });
    expect(job.ok).toBe(true);
    expect(job.data?.job.status).toBe("draft");
    expect(job.data?.job.provider).toBe("kie");
    expect(job.data?.job.referenceAssets).toHaveLength(1);
  });

  it("submits provider jobs and reconciles completion outputs", async () => {
    const submitted: VideoGenerationJob[] = [];
    const videos = service({
      async submitVideoJob(job) {
        submitted.push(job);
        return { providerTaskId: "kie_task_1", raw: { operationName: "kie_task_1" } };
      }
    });

    const created = await videos.createVideoJob(ctx, {
      prompt: "A cafe opening reel",
      ownerId: "customer_1",
      durationSeconds: 6,
      resolution: "720p"
    });
    const submittedJob = await videos.submitVideoJob(ctx, { jobId: created.data!.job.id });
    expect(submittedJob.ok).toBe(true);
    expect(submittedJob.data?.job.status).toBe("submitted");
    expect(submittedJob.data?.job.providerTaskId).toBe("kie_task_1");
    expect(submitted).toHaveLength(1);

    const completed = await videos.recordVideoProviderStatus(ctx, {
      providerTaskId: "kie_task_1",
      status: "completed",
      providerUrls: ["https://provider.example/video.mp4"]
    });
    expect(completed.ok).toBe(true);
    expect(completed.data?.job.status).toBe("completed");
    expect(completed.data?.job.progress).toBe(100);
    expect(completed.data?.outputs).toHaveLength(1);
    expect(completed.data?.outputs[0]?.providerUrl).toBe("https://provider.example/video.mp4");

    const repeatedCompletion = await videos.recordVideoProviderStatus(ctx, {
      providerTaskId: "kie_task_1",
      status: "completed",
      providerUrls: ["https://provider.example/video.mp4"]
    });
    expect(repeatedCompletion.data?.outputs).toHaveLength(1);

    const stored = await videos.attachVideoOutput(ctx, {
      jobId: created.data!.job.id,
      storageKey: "tenant_1/videos/out.mp4",
      publicUrl: "https://cdn.example/videos/out.mp4",
      sizeBytes: 2048
    });
    expect(stored.ok).toBe(true);

    const snapshot = await videos.getVideoJob(ctx, created.data!.job.id);
    expect(snapshot.data?.outputs).toHaveLength(2);
  });

  it("cancels non-terminal jobs and lists by owner/status", async () => {
    const videos = service();
    const first = await videos.createVideoJob(ctx, {
      prompt: "First",
      ownerId: "customer_1"
    });
    const second = await videos.createVideoJob(ctx, {
      prompt: "Second",
      ownerId: "customer_2"
    });

    const cancelled = await videos.cancelVideoJob(ctx, {
      jobId: first.data!.job.id,
      reason: "User cancelled"
    });
    expect(cancelled.ok).toBe(true);
    expect(cancelled.data?.status).toBe("cancelled");

    const customerOne = await videos.listVideoJobs(ctx, { ownerId: "customer_1" });
    expect(customerOne.data).toHaveLength(1);
    expect(customerOne.data?.[0]?.id).toBe(first.data!.job.id);

    const drafts = await videos.listVideoJobs(ctx, { status: "draft" });
    expect(drafts.data?.map((job) => job.id)).toEqual([second.data!.job.id]);
  });
});
