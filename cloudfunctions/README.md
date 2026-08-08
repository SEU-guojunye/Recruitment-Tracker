# CloudBase functions

`recruitmentSnapshot` is the only server-side runtime required by the MVP.

- Runtime: CloudBase Event Function, Node.js 18.15.
- Invocation: authenticated CloudBase Web SDK calls only; no HTTP route.
- Identity: derives `uid` from `app.auth().getUserInfo()` and never trusts a client owner ID.
- Data: validates the complete snapshot, enforces the 8 MiB limit, fixes owner fields, and writes one `user_snapshots/{uid}` document with server time.
- Conflict safety: rejects another `sourceDeviceId` and stale same-device revisions unless the caller explicitly requests device takeover.
- Rollback: delete the function. Local extension data is unaffected.

The deployment must inject `TCB_ENV` with the target environment ID and keep invocation permission restricted to authenticated users.
