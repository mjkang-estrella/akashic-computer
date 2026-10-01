# Akashic Computer companion

The companion connects the public catalog and account workspace at akashic.computer to the user's LAN fleet. The existing internal package/plugin ID stays `akashic-local` so installed clients and stored conversations remain compatible.

## Install and run

Run `npm ci` in the repository root first, then in this directory:

```sh
npm ci
npm run build
npm run setup -- --fleet /absolute/path/to/fleet --endpoint http://YOUR-LAN-HOST:8888/v1 --model YOUR-MODEL-ID
npm start
```

Do not run setup again for an existing installation. Open `http://127.0.0.1:4310` and use the token in `~/.local/share/akashic-local/token`. The controller binds loopback, keeps normal SSH host-key validation, and uses only enrolled inventory targets. Private configuration, logs, and conversations stay in that directory.

For persistent operation on macOS, stop a manually started controller after its jobs finish, then run `npm run install:service`. The user LaunchAgent is `computer.akashic.local`; it runs the controller at login. To stop it without deleting data:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/computer.akashic.local.plist
```

## Connect your account

Sign into `https://akashic.computer/computers` with the configured owner's GitHub account. Create an enrollment code, run the displayed `npm run connect -- --site … --code …` command in this directory, and confirm the computer name on the website. The CLI writes the connector credential to `cloud.json` with owner-only permissions. No SSH keys or model endpoint credentials are uploaded.

Select **Account · this controller** in the companion or plugin to use the same conversations and job records as the website. **Device only** retains the existing local workflow. Old transcripts are never automatically uploaded.

Account mode sends prompts, answers, bounded progress, and device metadata through Convex. The local model still performs every inference call. MCP App interactions also pass through the host application; this is not a promise of offline operation or zero host telemetry. Sharing a selected answer explicitly sends it to ChatGPT.

## Desktop plugin

```sh
npm run build
npm run package
codex plugin marketplace add ~/.local/share/akashic-local/marketplace
codex plugin add akashic-local@akashic-personal
```

The displayed name is **Akashic Computer**. Open a fresh local chat if tools do not refresh, enable the plugin, and ask to open Akashic Computer. The package contains a self-contained stdio server and the same React workspace used by the website. The controller must be running.

Model-facing operations remain `open_workspace`, `delegate_task`, `get_task_status`, and `get_task_result`. Existing delegation remains device-only for compatibility. App-only account operations use connector-scoped cloud records. UI interaction never automatically requests ChatGPT reasoning or updates its model context.

## Safety and recovery

- One inference job runs per controller across local and account work.
- The local agent can list devices, inspect read-only health, and list models. It cannot execute arbitrary shell commands, install models, or change services.
- Maximum six model rounds, six tool calls per round, and 8192 output tokens. The UI always uses the maximum 8192-token budget.
- Last 12 non-partial messages, bounded to 48,000 characters, form context. Inference requests time out after three minutes.
- Local state uses atomic file replacement and retains partial output. Restarted jobs become interrupted; they are not replayed automatically.
- Cloud job IDs are durable idempotency keys. Reconnect reconciles prior receipts before claiming work. An unknown execution is interrupted, not repeated.
- Cancellation closes the inference request; resource release depends on the runtime honoring disconnects.
- A revoked credential stops further cloud access. Revocation cannot reach a disconnected controller until it reconnects.

Private `config.json` supports `hostOverrides` and an optional `artifactRepo` mapping for the configured model. Mark retired nodes as `state: "retired"` with `ssh_alias: null`. A planned or retired machine never receives an SSH probe. `apiKeyEnv` names an environment variable for authenticated inference endpoints; its value remains local.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

See [connected workspace operations](../docs/connected-workspace.md) for authentication configuration, rollout, and rollback. Tests cover protocol fragmentation, quotas, cancellation, idempotence, offline endpoints, connector reconnects, and preservation of unrelated local jobs.
