<script lang="ts">
  // Interactive wrapper for the file-media module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real
  // two-phase flow: createUploadTicket (media.upload_requested, status pending),
  // completeUpload (media.uploaded, promotes ticket → MediaFile), deleteFile
  // (media.deleted). An over-cap ticket is shown rejected, mirroring the size
  // validation completeUpload enforces.
  import Preview from "@microservices-sh/file-media/preview";

  let { module: m }: { module: any } = $props();

  const TENANT = "tenant_acme";
  let tSeq = 1;
  let fSeq = 1;
  const safe = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = (id: string, name: string) => `${TENANT}/${id}/${safe(name)}`;

  let tickets = $state<any[]>([]);
  let files = $state<any[]>([
    { id: `mf_${fSeq++}`, key: key("seed1", "logo.svg"), contentType: "image/svg+xml", originalName: "logo.svg", bytes: 12_400, status: "active" },
    { id: `mf_${fSeq++}`, key: key("seed2", "onboarding.pdf"), contentType: "application/pdf", originalName: "onboarding.pdf", bytes: 1_240_000, status: "active" }
  ]);

  function onrequest(input: { originalName: string; contentType: string; bytes: number; maxBytes: number }) {
    // createUploadTicket → media.upload_requested (pending, tenant-scoped key + cap)
    const id = `tk_${tSeq++}`;
    tickets = [
      { id, key: key(id, input.originalName), contentType: input.contentType, originalName: input.originalName, bytes: input.bytes, maxBytes: input.maxBytes, expiresAt: new Date(Date.now() + 36e5).toISOString() },
      ...tickets
    ];
  }
  function oncomplete(ticketId: string) {
    // completeUpload → media.uploaded (only if within cap; promotes to a MediaFile)
    const t = tickets.find((x) => x.id === ticketId);
    if (!t || t.bytes > t.maxBytes) return;
    files = [{ id: `mf_${fSeq++}`, key: t.key, contentType: t.contentType, originalName: t.originalName, bytes: t.bytes, status: "active" }, ...files];
    tickets = tickets.filter((x) => x.id !== ticketId);
  }
  function ondelete(fileId: string) {
    // deleteFile → media.deleted
    files = files.map((f) => (f.id === fileId ? { ...f, status: "deleted" } : f));
  }
</script>

<Preview {tickets} {files} {onrequest} {oncomplete} {ondelete} />
