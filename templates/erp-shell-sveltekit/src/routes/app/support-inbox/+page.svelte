<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, EmptyState, Field, MetricStrip, PageHeader, ResourceTable } from "$lib/ui";
  import type { Metric, Tone } from "$lib/ui/types";

  let { data, form } = $props();

  const thread = $derived(data.selectedThread);
  const metrics = $derived<Metric[]>([
    { label: "Conversations", value: data.metrics.total, tone: data.metrics.total > 0 ? "info" : "neutral", hint: "all channels" },
    { label: "Active", value: data.metrics.active, tone: data.metrics.active > 0 ? "warn" : "good", hint: "needs review" },
    { label: "Resolved", value: data.metrics.resolved, tone: data.metrics.resolved > 0 ? "good" : "neutral", hint: "closed by team" },
    { label: "Takeover", value: data.metrics.takeover, tone: data.metrics.takeover > 0 ? "warn" : "neutral", hint: "assistant paused" }
  ]);

  const statusFilters = [
    { id: "all", label: "All", href: "/app/support-inbox" },
    { id: "active", label: "Active", href: "/app/support-inbox?status=active" },
    { id: "resolved", label: "Resolved", href: "/app/support-inbox?status=resolved" },
    { id: "archived", label: "Archived", href: "/app/support-inbox?status=archived" }
  ];

  const channelFilters = [
    { id: "all", label: "All channels", href: "/app/support-inbox" },
    { id: "web", label: "Web", href: "/app/support-inbox?channel=web" },
    { id: "whatsapp", label: "WhatsApp", href: "/app/support-inbox?channel=whatsapp" }
  ];

  function statusTone(status: string): Tone {
    switch (status) {
      case "active":
        return "warn";
      case "resolved":
        return "good";
      case "archived":
        return "neutral";
      default:
        return "neutral";
    }
  }

  function roleTone(role: string): Tone {
    switch (role) {
      case "agent":
        return "good";
      case "assistant":
        return "info";
      case "system":
        return "neutral";
      default:
        return "warn";
    }
  }

  function when(value: string): string {
    return new Date(value).toLocaleString();
  }
</script>

<svelte:head>
  <title>Support Inbox | ERP Shell</title>
</svelte:head>

<main class="section support-inbox-page">
  <PageHeader
    eyebrow="Live support"
    title="Support inbox"
    description="Widget conversations, agent takeover, and support message threads powered by the support-inbox module."
  >
    {#snippet meta()}
      <Badge tone={data.status.status === "draft" ? "warn" : "good"}>{data.status.status}</Badge>
      <span>{data.status.id}</span>
    {/snippet}
  </PageHeader>

  {#if form?.conversationStarted}
    <Alert tone="success">Conversation started.</Alert>
  {:else if form?.agentMessageAdded}
    <Alert tone="success">Agent reply added.</Alert>
  {:else if form?.takeoverUpdated}
    <Alert tone="success">Takeover state updated.</Alert>
  {:else if form?.statusUpdated}
    <Alert tone="success">Conversation status updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="filter-row">
    {#each statusFilters as filter (filter.id)}
      <a class:active={data.activeStatus === filter.id && data.activeChannel === "all"} href={filter.href}>{filter.label}</a>
    {/each}
    <span class="filter-divider"></span>
    {#each channelFilters as filter (filter.id)}
      <a class:active={data.activeChannel === filter.id && data.activeStatus === "all"} href={filter.href}>{filter.label}</a>
    {/each}
  </div>

  <div class="grid">
    <section class="grid__main">
      <Card title="Conversations">
        {#snippet header()}
          <Badge tone="neutral">{data.conversations.length}</Badge>
        {/snippet}

        {#if data.conversations.length > 0}
          <ResourceTable class="flush" caption="Support inbox conversations">
            {#snippet head()}
              <tr>
                <th>Session</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Takeover</th>
                <th>Updated</th>
                <th></th>
              </tr>
            {/snippet}
            {#each data.conversations as conversation (conversation.id)}
              <tr>
                <td data-label="Session">
                  <a class="table-primary" href={`/app/support-inbox?conversation=${conversation.id}`}>{conversation.sessionId}</a>
                  <span class="table-muted">{conversation.pageUrl ?? conversation.externalId ?? "widget"}</span>
                </td>
                <td data-label="Channel" class="table-muted">{conversation.channel}</td>
                <td data-label="Status"><Badge tone={statusTone(conversation.status)}>{conversation.status}</Badge></td>
                <td data-label="Takeover">
                  <Badge tone={conversation.agentTakeover ? "warn" : "neutral"}>{conversation.agentTakeover ? "agent" : "assistant"}</Badge>
                </td>
                <td data-label="Updated" class="table-muted">{when(conversation.updatedAt)}</td>
                <td class="table-action">
                  <Button href={`/app/support-inbox?conversation=${conversation.id}`} size="sm" variant="ghost">Open</Button>
                </td>
              </tr>
            {/each}
          </ResourceTable>
        {:else}
          <EmptyState title="No conversations" description="Widget and channel conversations will appear here." />
        {/if}
      </Card>

      <Card title="Thread" class="stack">
        {#if thread}
          <div class="thread-head">
            <div>
              <strong>{thread.conversation.sessionId}</strong>
              <p>{thread.conversation.channel} - {thread.conversation.pageUrl ?? thread.conversation.externalId ?? "widget"}</p>
            </div>
            <Badge tone={statusTone(thread.conversation.status)}>{thread.conversation.status}</Badge>
          </div>

          {#if thread.messages.length > 0}
            <ol class="messages">
              {#each thread.messages as message (message.id)}
                <li>
                  <div class="message-head">
                    <Badge tone={roleTone(message.role)}>{message.role}</Badge>
                    <span>{when(message.createdAt)}</span>
                  </div>
                  <p>{message.content}</p>
                  {#if message.sources.length > 0}
                    <small>{message.sources.join(", ")}</small>
                  {/if}
                </li>
              {/each}
            </ol>
          {:else}
            <EmptyState title="No messages" description="Messages will appear after a visitor or agent writes." />
          {/if}
        {:else}
          <EmptyState title="No thread selected" description="Open a conversation to inspect its messages." />
        {/if}
      </Card>
    </section>

    <aside class="grid__side">
      {#if data.canManage}
        <Card title="Start conversation">
          <form method="POST" action="?/startConversation" use:enhance>
            <Field label="Session" id="inbox-session">
              <input id="inbox-session" name="sessionId" placeholder="visitor-session-123" />
            </Field>
            <Field label="Channel" id="inbox-channel" required>
              <select id="inbox-channel" name="channel" required>
                <option value="web">Web</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </Field>
            <Field label="External ID" id="inbox-external">
              <input id="inbox-external" name="externalId" placeholder="wa-message-id" />
            </Field>
            <Field label="Page URL" id="inbox-page">
              <input id="inbox-page" name="pageUrl" placeholder="/pricing" />
            </Field>
            <Field label="Visitor message" id="inbox-message" required>
              <textarea id="inbox-message" name="message" rows="4" required>Can someone help me pick a plan?</textarea>
            </Field>
            <Button type="submit" variant="primary">Start conversation</Button>
          </form>
        </Card>

        <Card title="Agent controls" class="stack">
          {#if thread}
            <form method="POST" action="?/addAgentMessage" use:enhance>
              <input type="hidden" name="conversationId" value={thread.conversation.id} />
              <Field label="Reply" id="agent-reply" required>
                <textarea id="agent-reply" name="content" rows="4" required></textarea>
              </Field>
              <Button type="submit" variant="primary">Send reply</Button>
            </form>

            <div class="control-row">
              <form method="POST" action="?/setAgentTakeover" use:enhance>
                <input type="hidden" name="conversationId" value={thread.conversation.id} />
                <input type="hidden" name="enabled" value={thread.conversation.agentTakeover ? "false" : "true"} />
                <Button type="submit" variant="ghost">
                  {thread.conversation.agentTakeover ? "Resume assistant" : "Take over"}
                </Button>
              </form>

              <form class="status-form" method="POST" action="?/updateStatus" use:enhance>
                <input type="hidden" name="conversationId" value={thread.conversation.id} />
                <Field label="Status" id="conversation-status">
                  <select id="conversation-status" name="status">
                    <option value="active" selected={thread.conversation.status === "active"}>Active</option>
                    <option value="resolved" selected={thread.conversation.status === "resolved"}>Resolved</option>
                    <option value="archived" selected={thread.conversation.status === "archived"}>Archived</option>
                  </select>
                </Field>
                <Button type="submit" variant="ghost">Save status</Button>
              </form>
            </div>
          {:else}
            <EmptyState title="No conversation selected" description="Open a conversation before using agent controls." />
          {/if}
        </Card>
      {/if}

      <Card title="Widget" class="stack">
        {#if data.widget}
          <dl class="settings">
            <div><dt>Enabled</dt><dd>{data.widget.enabled ? "yes" : "no"}</dd></div>
            <div><dt>Position</dt><dd>{data.widget.position}</dd></div>
            <div><dt>Branding</dt><dd>{data.widget.showBranding ? "shown" : "hidden"}</dd></div>
            <div><dt>Greeting</dt><dd>{data.widget.greeting}</dd></div>
          </dl>
        {:else}
          <EmptyState title="No widget settings" description="Settings are created when the module config is loaded." />
        {/if}
      </Card>
    </aside>
  </div>
</main>

<style>
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-block-start: 16px;
  }
  .filter-row a {
    display: inline-flex;
    align-items: center;
    min-block-size: 32px;
    padding-inline: 11px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-ink-soft);
    font-size: 0.83rem;
    font-weight: 600;
    text-decoration: none;
  }
  .filter-row a.active {
    border-color: var(--color-act);
    background: var(--color-green-soft);
    color: var(--color-green-dark);
  }
  .filter-divider {
    inline-size: 1px;
    block-size: 24px;
    background: var(--color-line);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr);
    gap: 16px;
    margin-block-start: 16px;
  }
  :global(.card.stack) {
    margin-block-start: 16px;
  }
  .table-primary {
    display: block;
  }
  .thread-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-block-end: 16px;
  }
  .thread-head p {
    margin: 4px 0 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .messages {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .messages li {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 12px;
    background: var(--color-surface-2);
  }
  .message-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-end: 8px;
  }
  .message-head span,
  .messages small {
    color: var(--color-ink-faint);
    font-size: 0.78rem;
  }
  .messages p {
    margin: 0;
    color: var(--color-ink-soft);
    line-height: 1.55;
  }
  .control-row {
    display: grid;
    gap: 12px;
    margin-block-start: 16px;
  }
  .status-form {
    display: grid;
    gap: 10px;
  }
  .status-form :global(.field) {
    margin-block-end: 0;
  }
  .settings {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .settings div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .settings dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .settings dd {
    margin: 0;
    min-inline-size: 0;
    text-align: end;
  }
  @media (max-width: 980px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
