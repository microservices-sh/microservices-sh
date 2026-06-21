<script lang="ts">
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Accept invitation · ERP Shell</title>
</svelte:head>

<main class="section">
  <Card>
    <Eyebrow>Team invitation</Eyebrow>
    <h1>Join the organization.</h1>
    {#if form?.error}
      <Alert tone="error">{form.error}</Alert>
    {/if}
    <form method="POST">
      <Field label="Invitation token" id="token">
        <input id="token" name="token" required value={data.token} />
      </Field>
      <Button type="submit" variant="primary">Accept invitation</Button>
    </form>
  </Card>
</main>
