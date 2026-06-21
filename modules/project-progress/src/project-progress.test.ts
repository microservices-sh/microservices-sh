import { describe, expect, it } from "vitest";
import { createProjectProgressMemoryStore } from "./adapters/memory";
import {
  createProjectProgressService,
  createSequentialProjectProgressIdFactory,
  createSequentialProjectProgressTokenFactory
} from "./service";
import type { TenantContext } from "./types";

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "admin_1",
  now: "2026-06-21T00:00:00.000Z"
};

function service() {
  return createProjectProgressService({
    store: createProjectProgressMemoryStore(),
    createId: createSequentialProjectProgressIdFactory(),
    createAccessToken: createSequentialProjectProgressTokenFactory()
  });
}

describe("project-progress", () => {
  it("creates projects, grants worker access, and resolves public snapshots", async () => {
    const progress = service();
    const created = await progress.createProject(ctx, {
      customerId: "cust_1",
      title: "Office Renovation",
      location: "Central",
      startDate: "2026-06-20"
    });
    expect(created.ok).toBe(true);
    expect(created.data?.project.accessToken).toBe("ptok_0000000001");

    const grant = await progress.grantProjectAccess(ctx, {
      projectId: created.data!.project.id,
      userId: "worker_1",
      canUpload: true
    });
    expect(grant.ok).toBe(true);

    const workerProjects = await progress.listProjects(ctx, { userId: "worker_1" });
    expect(workerProjects.data).toHaveLength(1);

    const publicSnapshot = await progress.resolvePublicProject(ctx, created.data!.project.accessToken);
    expect(publicSnapshot.ok).toBe(true);
    expect(publicSnapshot.data?.project.title).toBe("Office Renovation");
  });

  it("records progress logs, media metadata, and comments", async () => {
    const progress = service();
    const created = await progress.createProject(ctx, {
      customerId: "cust_1",
      title: "Shop Fitout"
    });

    const snapshot = await progress.createProgressLog(ctx, {
      projectId: created.data!.project.id,
      uploaderId: "worker_1",
      category: "carpentry",
      description: "Installed display shelves.",
      capturedAt: "2026-06-21T08:00:00.000Z"
    });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.timeline).toHaveLength(1);
    const logId = snapshot.data!.timeline[0]!.log.id;

    const media = await progress.attachProgressMedia(ctx, {
      logId,
      storageKey: "tenant_1/progress/shelf.jpg",
      thumbnailKey: "tenant_1/progress/shelf_thumb.jpg",
      fileType: "image",
      mimeType: "image/jpeg",
      fileSizeBytes: 2048,
      width: 1200,
      height: 800
    });
    expect(media.ok).toBe(true);

    const comment = await progress.addProjectComment(ctx, {
      projectId: created.data!.project.id,
      logId,
      authorType: "customer",
      authorName: "Customer",
      content: "Looks good."
    });
    expect(comment.ok).toBe(true);

    const updated = await progress.getProjectSnapshot(ctx, created.data!.project.id);
    expect(updated.data?.timeline[0]?.media).toHaveLength(1);
    expect(updated.data?.timeline[0]?.comments).toHaveLength(1);
    expect(updated.data?.comments).toHaveLength(1);
  });

  it("keeps in-memory project ids isolated by tenant", async () => {
    const progress = createProjectProgressService({
      store: createProjectProgressMemoryStore(),
      createId: () => "shared_id",
      createAccessToken: () => "shared_token"
    });

    const tenantA = await progress.createProject({ ...ctx, tenantId: "tenant_a" }, {
      customerId: "cust_a",
      title: "Tenant A Project"
    });
    const tenantB = await progress.createProject({ ...ctx, tenantId: "tenant_b" }, {
      customerId: "cust_b",
      title: "Tenant B Project"
    });

    expect(tenantA.ok).toBe(true);
    expect(tenantB.ok).toBe(true);
    expect((await progress.getProjectSnapshot({ ...ctx, tenantId: "tenant_a" }, "shared_id")).data?.project.title).toBe("Tenant A Project");
    expect((await progress.getProjectSnapshot({ ...ctx, tenantId: "tenant_b" }, "shared_id")).data?.project.title).toBe("Tenant B Project");
  });

  it("updates status and revokes access", async () => {
    const progress = service();
    const created = await progress.createProject(ctx, {
      customerId: "cust_1",
      title: "Kitchen Works",
      status: "in_progress"
    });
    await progress.grantProjectAccess(ctx, {
      projectId: created.data!.project.id,
      userId: "worker_1"
    });

    const completed = await progress.updateProjectStatus(ctx, {
      projectId: created.data!.project.id,
      status: "completed"
    });
    expect(completed.ok).toBe(true);
    expect(completed.data?.actualEndDate).toBe(ctx.now);

    await progress.revokeProjectAccess(ctx, {
      projectId: created.data!.project.id,
      userId: "worker_1"
    });
    const workerProjects = await progress.listProjects(ctx, { userId: "worker_1" });
    expect(workerProjects.data).toHaveLength(0);
  });
});
