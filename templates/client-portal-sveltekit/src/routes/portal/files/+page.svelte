<script lang="ts">
  import { enhance } from "$app/forms";
  import { statusPillClass } from "$lib/status";
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Files · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Documents</p>
      <h1>Your files.</h1>
      <p>
        Upload and review documents. Uploads use the file-media module's two-step flow:
        a tenant-scoped ticket is reserved, the bytes are stored, then the upload is
        verified and recorded.
      </p>
      <p><a class="button secondary" href="/portal">Back to dashboard</a></p>

      {#if form?.uploaded}
        <p class="status">Uploaded <strong>{form.uploaded}</strong>.</p>
      {:else if form?.error}
        <p class="status error">{form.error}</p>
      {/if}

      <section class="panel mt-6">
        <h2>Upload a document</h2>
        <form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
          <div class="field">
            <label for="file">File (PDF, PNG, or JPEG)</label>
            <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required />
          </div>
          <button type="submit">Upload</button>
        </form>
      </section>
    </section>

    <section class="panel">
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
              <span class={statusPillClass(file.status)}>{file.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
