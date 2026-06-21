<script>
  import { Card, Eyebrow, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();

  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
</script>

<svelte:head>
  <title>Files · Accounting ERP</title>
</svelte:head>

<main class="section">
  <Eyebrow>Document storage</Eyebrow>
  <h1>Files</h1>
  <p>Company files stored via the file-media module (object bytes live in R2).</p>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {:else if form?.uploaded}
    <Alert tone="success">Uploaded {form.name}.</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      {#if data.files.length > 0}
        <ul class="list" role="list">
          {#each data.files as file}
            <li class="list-item row-item">
              <span><strong>{file.name}</strong></span>
              <span class="nav" style="align-items: center;">
                <Badge tone="info">{file.contentType}</Badge>
                <span>{kb(file.bytes)}</span>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p>No files yet.</p>
      {/if}
    </Card>

    <Card>
      <h2>Upload a file</h2>
      <form method="POST" action="?/upload" enctype="multipart/form-data">
        <Field label="File" id="file">
          <input id="file" name="file" type="file" required />
        </Field>
        <Button type="submit" variant="primary">Upload</Button>
      </form>
    </Card>
  </div>
</main>
