<script lang="ts">
  import { enhance } from "$app/forms";
  import { statusBadgeVariant } from "$lib/status";
  import { Button, Field, Card, Alert, Eyebrow, Badge } from "$lib/ui";
  let { data, form } = $props();

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  }

  function usagePercent(storage: { usedBasisPoints: number }): number {
    return Math.min(100, Math.round(storage.usedBasisPoints / 100));
  }
</script>

<svelte:head>
  <title>Files · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Documents</Eyebrow>
      <h1>Your files.</h1>
      <p>
        Upload and review documents. Uploads use the file-media module's two-step flow:
        a customer-scoped ticket is reserved, the bytes are stored, then the upload is
        verified and recorded.
      </p>
      <p><Button href="/portal" variant="ghost">Back to dashboard</Button></p>

      {#if form?.uploaded}
        <Alert tone="success">Uploaded <strong>{form.uploaded}</strong>.</Alert>
      {:else if form?.error}
        <Alert tone="error">{form.error}</Alert>
      {/if}

      <Card class="mt-6">
        <h2>Storage</h2>
        <div class="storage-meter" aria-label="Storage usage">
          <div class="storage-meter__summary">
            <strong>{formatBytes(data.storage.usedBytes)} used</strong>
            <span>{formatBytes(data.storage.remainingBytes)} remaining</span>
          </div>
          <progress max="100" value={usagePercent(data.storage)} aria-label="Storage usage">
            {usagePercent(data.storage)}%
          </progress>
          <p>{usagePercent(data.storage)}% of {formatBytes(data.storage.quotaBytes)} included storage is in use.</p>
        </div>
      </Card>

      <Card class="mt-6">
        <h2>Upload a document</h2>
        <form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
          <Field label="File (PDF, PNG, or JPEG)" id="file">
            <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required />
          </Field>
          <Button type="submit" variant="primary">Upload</Button>
        </form>
      </Card>
    </section>

    <Card>
      <h2>All documents</h2>
      {#if data.files.length === 0}
        <p>No documents yet.</p>
      {:else}
        <ul class="list">
          {#each data.files as file}
            <li class="list-item row-item">
              <div>
                <strong>{file.originalName}</strong>
                <p>{file.contentType} · {Math.ceil(file.bytes / 1024)} KB · {new Date(file.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge tone={statusBadgeVariant(file.status)}>{file.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
</main>
