<script lang="ts">
  // Interactive wrapper for the calendar-google module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend — the demo mirrors the
  // real use cases: connectCalendar (connected), syncCalendar incremental by
  // syncToken (synced + event.upserted/deleted), a 410-Gone full resync, plus
  // token.refreshed / channel.renewed. Re-syncing an unchanged batch is deduped.
  import Preview from "@microservices-sh/calendar-google/preview";

  let { module: m }: { module: any } = $props();

  const at = (dayOffset: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // Pre-scripted incremental change batches Google would return per sync run.
  const BATCHES: { upsert: any[]; delete: string[] }[] = [
    { upsert: [
      { id: "ev_standup", summary: "Daily standup", status: "confirmed", startAt: at(1, 9), recurring: true },
      { id: "ev_review", summary: "Design review", status: "tentative", startAt: at(1, 14), recurring: false }
    ], delete: [] },
    { upsert: [
      { id: "ev_review", summary: "Design review", status: "confirmed", startAt: at(1, 15), recurring: false },
      { id: "ev_1on1", summary: "1:1 with Grace", status: "confirmed", startAt: at(2, 11), recurring: false }
    ], delete: [] },
    { upsert: [
      { id: "ev_standup", summary: "Daily standup", status: "cancelled", startAt: at(1, 9), recurring: true }
    ], delete: [] }
  ];

  // Seeded mid-lifecycle: the token is near expiry and the channel is ~1 day out,
  // so the refresh/renew controls are live — the distinctive infra of this module.
  let connected = $state(false);
  let tokenFresh = $state(false);
  let tokenExpiresLabel = $state("expires in 3m");
  let channelExpiresDays = $state(1);
  let syncToken = $state<string | null>(null);
  let events = $state<any[]>([]);
  let lastSync = $state<any>(null);
  let batchIdx = $state(0);
  let tokenSeq = 1;

  function onconnect() {
    // connectCalendar → calendar-google.connected (no syncToken yet → first sync is full)
    connected = true;
    syncToken = null;
  }

  function applyBatch(full: boolean) {
    const batch = BATCHES[Math.min(batchIdx, BATCHES.length - 1)];
    const hasMore = batchIdx < BATCHES.length;
    let upserted = 0, deleted = 0, deduped = 0;
    if (!hasMore) {
      // nothing new since last cursor — every event Google returns is unchanged
      deduped = events.length;
    } else {
      const next = [...events];
      for (const u of batch.upsert) {
        const i = next.findIndex((e) => e.id === u.id);
        if (i >= 0) { if (next[i].status === u.status && next[i].startAt === u.startAt) { deduped++; continue; } next[i] = u; } else next.push(u);
        upserted++;
      }
      for (const id of batch.delete) { const i = next.findIndex((e) => e.id === id); if (i >= 0) { next.splice(i, 1); deleted++; } }
      events = next;
      batchIdx += 1;
    }
    syncToken = `ct_${(1000 + batchIdx).toString(36)}`; // final-page cursor persisted as next syncToken
    lastSync = { upserted, deleted, deduped, full };
  }

  function onsync() {
    // syncCalendar → incremental (syncToken present) or full (null) → synced
    applyBatch(syncToken === null);
  }
  function onresync() {
    // 410 Gone invalidates the cursor → next sync is a full resync from scratch
    syncToken = null;
    events = [];
    batchIdx = 0;
    lastSync = null;
  }
  function onrefreshtoken() {
    // single-flight refreshAccessToken → calendar-google.token.refreshed
    tokenFresh = true;
    tokenExpiresLabel = `refreshed · expires in 60m`;
    tokenSeq += 1;
  }
  function onrenewchannel() {
    // renewExpiringChannels → calendar-google.channel.renewed
    channelExpiresDays = 7;
  }
</script>

<Preview
  calendarId="primary"
  {connected}
  {tokenFresh}
  {tokenExpiresLabel}
  {channelExpiresDays}
  {syncToken}
  {events}
  {lastSync}
  {onconnect}
  {onsync}
  {onresync}
  {onrefreshtoken}
  {onrenewchannel}
/>
