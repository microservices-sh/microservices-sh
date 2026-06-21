# Support Inbox Admin Reference UI

Expected admin surfaces:

- Widget settings: enabled state, color, position, greeting, placeholder, branding.
- Quick actions: sorted link/message buttons shown in the visitor widget.
- Inbox: conversations by project, status, channel, latest activity, and agent takeover state.
- Thread view: visitor, assistant, agent, and system messages with source ids.
- Channels: WhatsApp connection metadata using secret references only.

Expected permissions:
- `support-inbox.read` for read views.
- `support-inbox.write` for widget and quick-action settings.
- `support-inbox.agent` for agent takeover and agent messages.
- `support-inbox.channel-admin` for channel connection metadata.
