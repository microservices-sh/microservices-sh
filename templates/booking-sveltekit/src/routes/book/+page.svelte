<script lang="ts">
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
      <p class="eyebrow">Booking flow</p>
      <h1>Choose a time.</h1>
      <p>
        This page uses native form semantics and a SvelteKit action, while the actual
        booking behavior runs through detached module use cases.
      </p>

      <form method="GET" class="panel" action="/book">
        <div class="field-grid">
          <div class="field">
            <label for="serviceId">Service</label>
            <select id="serviceId" name="serviceId">
              {#each data.services as service}
                <option value={service.id} selected={service.id === data.serviceId}>{service.name}</option>
              {/each}
            </select>
          </div>
          <div class="field">
            <label for="date">Date</label>
            <input id="date" name="date" type="date" value={data.date} required />
          </div>
        </div>
        <button type="submit" class="secondary">Refresh availability</button>
      </form>
    </section>

    <section class="panel">
      <h2>Confirm booking</h2>
      {#if form?.error}
        <div class="status error" aria-live="polite">Booking could not be created. Check the fields and try again.</div>
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
          <div class="field">
            <label for="customerName">Name</label>
            <input id="customerName" name="customerName" autocomplete="name" required maxlength="120" />
          </div>
          <div class="field">
            <label for="customerEmail">Email</label>
            <input id="customerEmail" name="customerEmail" type="email" autocomplete="email" required />
          </div>
        </div>
        <div class="field">
          <label for="customerPhone">Phone</label>
          <input id="customerPhone" name="customerPhone" autocomplete="tel" inputmode="tel" />
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes" rows="4"></textarea>
        </div>
        <button type="submit">Confirm booking</button>
      </form>
    </section>
  </div>
</main>
