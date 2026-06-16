<script lang="ts">
  import { enhance } from "$app/forms";
  import { statusBadgeVariant } from "$lib/status";
  import { Button, Field, Panel, StatusMessage, Eyebrow, Badge } from "$lib/components";
  let { data, form } = $props();
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
        a tenant-scoped ticket is reserved, the bytes are stored, then the upload is
        verified and recorded.
      </p>
      <p><Button href="/portal" variant="secondary">Back to dashboard</Button></p>

      {#if form?.uploaded}
        <StatusMessage>Uploaded <strong>{form.uploaded}</strong>.</StatusMessage>
      {:else if form?.error}
        <StatusMessage variant="error">{form.error}</StatusMessage>
      {/if}

      <Panel class="mt-6">
        <h2>Upload a document</h2>
        <form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
          <Field label="File (PDF, PNG, or JPEG)" id="file">
            <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required />
          </Field>
          <Button>Upload</Button>
        </form>
      </Panel>
    </section>

    <Panel>
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
              <Badge variant={statusBadgeVariant(file.status)}>{file.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</main>
