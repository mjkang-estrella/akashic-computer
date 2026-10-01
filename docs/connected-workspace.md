# Connected Akashic Computer workspace

The catalog remains public at `/`. `/workspace` and `/computers` use GitHub sign-in and the same Convex deployment. The website never connects to a user's localhost. The always-on controller connects outward to Convex and uses its existing LAN model endpoint and SSH inventory.

## Deploy and authenticate

Install root dependencies and run the existing checks. Configure these **server-side Convex** variables:

- `ALLOWED_GITHUB_USER_ID`: the owner's numeric GitHub ID. Missing or different IDs fail closed.
- `SITE_URL`: the canonical website URL.
- `JWT_PRIVATE_KEY` and `JWKS`: a matching RS256 signing key and public JWK set as required by Convex Auth.
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`: the GitHub OAuth application's client credentials.

Use the deployment's `.convex.site/api/auth/callback/github` URL as the GitHub callback. Request `read:user user:email`, never repository permissions. Store values through the deployment's secret/environment interface; do not put them in browser code, git, logs, or screenshots.

Frontend environment:

- `NEXT_PUBLIC_CONVEX_URL`: the existing cloud deployment URL.
- `NEXT_PUBLIC_CONVEX_SITE_URL`: the corresponding HTTP actions URL.
- `NEXT_PUBLIC_CONNECTED_WORKSPACE=true`: enables the connected workspace. Leave false until authentication is configured.

Deploy additive backend changes before enabling the frontend flag. Convex Auth is beta; this integration uses client-side React authentication and enforces access in Convex functions, without authenticated server-rendering dependencies.

## Connect the controller

1. Sign into `/computers` and create a connection code.
2. On the controller, from `local-computer`, run the exact `npm run connect -- --site … --code …` command shown on the page.
3. Confirm the displayed computer name in the signed-in website.
4. The controller stores its credential in `~/.local/share/akashic-local/cloud.json` with owner-only permissions. The database stores only its hash.
5. The running controller registers inventory and models within fifteen seconds. Enrollment codes expire after ten minutes and can be used once.

The existing fleet inventory and private host overrides remain the source of truth. No new SSH keys, inference listeners, or agents are installed on the Spark nodes. `artifactRepo` in the controller's private `config.json` can explicitly map the configured runtime to a catalog artifact. Without a matching online deployment and recent controller heartbeat, the catalog does not offer “Use running model.”

## Conversations and execution

New website conversations belong to the signed-in account. Prompts, final answers, bounded progress, and device metadata synchronize through Convex. The controller holds endpoint credentials and executes the actual local model loop. No cloud model is used.

The local interface and MCP App share React components with the website. Choose **Account · this controller** to use the same cloud conversation/job records, or **Device only** to keep using existing local conversations. Historical device-only transcripts are not uploaded. MCP panel traffic still passes through its host, and explicit sharing sends the selected answer to ChatGPT.

Only one inference request runs through a controller at a time across both local and account jobs. Cloud job IDs become persistent local idempotency keys. Leases identify the original execution and are never reassigned automatically. Reconnect first reconciles local receipts. A missing receipt produces an interrupted result rather than replay. Progress is reported in one-second batches; idle claims poll every five seconds and failures back off to thirty seconds.

Cancellation is requested in Convex and propagated to the local runner. Revoking a connector prevents further access and interrupts its cloud jobs. A disconnected process can learn about revocation only after reconnecting; the current agent has read-only tools. Closing the browser does not stop a running job.

## Rollback and checks

Disable `NEXT_PUBLIC_CONNECTED_WORKSPACE` and redeploy the frontend to hide account features. Keep additive tables and local session data. Removing or archiving `cloud.json` after stopping active cloud work disables relay participation while retaining device-only operation. Never delete the local state directory as an upgrade step.

Before release, test authentication, ownership isolation, enrollment expiry/reuse, credential revocation, duplicate submissions, cancellation, stream interruption, and lease reconciliation. Run root tests/typecheck/lint/build and companion tests/build. Verify a real sign-in, device heartbeat, and inference job from the production website, then exercise Safari, Chromium, and the in-app browser. A working preview or mocked identity is not evidence of production OAuth success.

Existing database snapshots may contain legacy catalog evidence fields. The schema retains these as optional data; list queries continue returning compact summaries. `workspaceMigrations:normalizeLegacySourceKeys` fills only absent normalized source keys and can be run once against an older development snapshot. It does not remove catalog data.
