<script lang="ts">
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { data, form } = $props();

  const fmtSlot = (iso: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: data.timezone,
    }).format(new Date(iso));
</script>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Booking flow</Eyebrow>
      <h1>Choose a time.</h1>
      <p>
        This page uses native form semantics and a SvelteKit action, while the actual
        booking behavior runs through detached module use cases.
      </p>

      <Card>
        <form method="GET" action="/book">
          <div class="field-grid">
            <Field label="Service" id="serviceId">
              <select id="serviceId" name="serviceId">
                {#each data.services as service}
                  <option value={service.id} selected={service.id === data.serviceId}>{service.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Date" id="date">
              <input id="date" name="date" type="date" value={data.date} required />
            </Field>
          </div>
          <Button type="submit" variant="ghost">Refresh availability</Button>
        </form>
      </Card>
    </section>

    <Card>
      <h2>Confirm booking</h2>
      {#if form?.error}
        <Alert tone="error">Booking could not be created. Check the fields and try again.</Alert>
      {/if}
      <form method="POST">
        <input type="hidden" name="serviceId" value={data.serviceId} />

        <fieldset>
          <legend>Available times</legend>
          <div class="list">
            {#each data.availability as slot, index}
              <label class="list-item">
                <input
                  type="radio"
                  name="startsAt"
                  value={slot.startsAt}
                  required
                  disabled={!slot.available}
                  checked={index === 0 && slot.available}
                />
                {fmtSlot(slot.startsAt)} {slot.available ? "" : "(unavailable)"}
              </label>
            {/each}
          </div>
        </fieldset>

        <div class="field-grid">
          <Field label="Name" id="customerName">
            <input id="customerName" name="customerName" autocomplete="name" required maxlength="120" />
          </Field>
          <Field label="Email" id="customerEmail">
            <input id="customerEmail" name="customerEmail" type="email" autocomplete="email" required />
          </Field>
        </div>
        <Field label="Phone" id="customerPhone">
          <input id="customerPhone" name="customerPhone" autocomplete="tel" inputmode="tel" />
        </Field>
        <Field label="Notes" id="notes">
          <textarea id="notes" name="notes" rows="4"></textarea>
        </Field>
        <Button type="submit" variant="primary">Confirm booking</Button>
      </form>
    </Card>
  </div>
</main>
