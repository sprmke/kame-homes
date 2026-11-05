---
title: 'Guest Messages — redirect'
status: active
tags: [guides, routes, account]
updated: 2026-08-09
---

# Guest Messages — redirect

Route: `/account/messages` → **`/account/stays`**

The guest account hub formerly labeled **Messages** is now **Stays**. See [stays.md](./stays.md).

## Host-facing knowledge

The guest account area calls this section **Stays** now. It is the same inbox where guests read and reply to conversations with hosts, including property and parking chats.

**Common host questions**

- Q: A guest clicked Messages and landed somewhere else. Is that expected?
  A: Yes. The old Messages link redirects to **Stays**, which is the same inbox with a clearer name.
- Q: Did the guest lose any conversations?
  A: No. The redirect only changes the address. Every existing thread is still in **Stays**.
- Q: Is this the same conversation I see in my Guest Inbox?
  A: Yes. The guest sees all their threads together, while you see the threads for your property or parking slot.

---

## Testing

| Layer | Path / spec                                | Manual |
| ----- | ------------------------------------------ | ------ |
| E2E   | `legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only                              | —      |
