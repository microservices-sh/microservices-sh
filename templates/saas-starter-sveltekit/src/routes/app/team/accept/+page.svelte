<script lang="ts">
  import { Button, Field, Panel, StatusMessage, Eyebrow } from "$lib/components";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Accept invitation · SaaS Starter</title>
</svelte:head>

<main class="section">
  <Panel>
    <Eyebrow>Team invitation</Eyebrow>
    <h1>Join the organization.</h1>
    {#if form?.error}
      <StatusMessage variant="error" live>{form.error}</StatusMessage>
    {/if}
    <form method="POST">
      <Field label="Invitation token" id="token">
        <input id="token" name="token" required value={data.token} />
      </Field>
      <Button type="submit">Accept invitation</Button>
    </form>
  </Panel>
</main>
