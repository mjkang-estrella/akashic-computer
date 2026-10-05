# Zima controller migration

Akashic Computer's account relay moved from the Mac to `mj-zima` on October 1, 2026. The website uses outbound HTTPS through Convex. The controller reaches the existing two-Spark model service over LAN. The browsing device needs internet access, not access to the home LAN or VPN. Zima and the model service must remain on and connected.

## Installed state

- Linux user service: `akashic-computer.service`, enabled with user lingering already enabled.
- Release: `/srv/projects/akashic-computer/releases/0.4.0-20261001`.
- Current release link: `/srv/projects/akashic-computer/current`.
- Inventory snapshot: `/srv/projects/akashic-computer/fleet/inventory/hosts.json`.
- Private controller state: `/home/mj-kang/.local/share/akashic-local`, directory mode 700, configuration and credentials mode 600.
- Controller identity: `mj-zima`, displayed as `ZimaBoard controller`.
- Mac companion: existing `computer.akashic.local` LaunchAgent with `relayEnabled: false`. Its local API and installed plugin remain available as clients. Existing device-only conversations remain on the Mac and are read-only in this mode.

The same cloud connector identity and credential were retained, preserving account conversations and deployment IDs. Two completed cloud execution receipts moved to Zima; three device-only conversations stayed on the Mac. SSH keys were not copied. The fleet inventory is a snapshot, with private overrides retaining Spark 3's retired state and the active TP2 group.

The prior `This Mac` device remains a historical `not-reported` observation. Zima's pre-existing `systemd-networkd-wait-online.service` failure is still reported as degraded health. The Akashic controller service is independently active; this migration did not restart or repair unrelated services.

## Operations

On Zima:

```sh
systemctl --user status akashic-computer.service
journalctl --user -u akashic-computer.service -n 50 --no-pager
```

To update, build a new companion release on the development machine, copy its `dist` assets and installer source to a new release directory, and wait for jobs to finish. Stop the old service, change the current symlink, rerun `src/install-service.mjs`, and verify health plus a cloud job. The installed unit points to the resolved release; changing only the symlink does not switch the service.

Do not expose port 4310 publicly. It remains loopback-only. Website access does not use it; the desktop plugin accesses the Mac's local companion, which forwards account operations through HTTPS.

## Rollback

Never enable two relays with the same connector credential.

1. Wait for Zima's active jobs to finish and synchronize. Stop its relay with `systemctl --user disable --now akashic-computer.service`.
2. Retain Zima's current `state.json`. If returning execution to the Mac, merge its cloud job receipts by `cloudJobId` and the associated sessions into the Mac state while both services are stopped. Do not replace the Mac's entire state with the older backup or discard its device-only history.
3. Restore the Mac's LAN access. Set `relayEnabled: true` in its existing private config and set `controllerName` to the desired Mac display name.
4. Start the Mac's existing LaunchAgent, verify that only it reports heartbeats, then run one new job. Preserve unknown/interrupted receipts rather than replaying them.

The pre-cutover Mac files are saved under `~/.local/share/akashic-local/migration-backup-20261001-131924`. They are recovery evidence, not a substitute for receipts produced after cutover.

## Verification

- Root tests: 80 passed. Companion tests: 22 passed. Both TypeScript checks, root lint, and both production builds passed.
- Production Convex deployment succeeded with an additive message-by-job index.
- Website direct chat returned `667` for `23 × 29` with the Mac relay disabled. The completed execution receipt was present on Zima.
- Installed MCP plugin 0.4.0 discovered its tools, delegated a new account job, and retrieved a completed answer. The agent executed `inspect_device` and `list_models` on Zima.
- Service restart preserved completed receipts without replay. The service is active and enabled, with user lingering enabled. A physical reboot was not performed.
- The signed-in in-app browser workflow was checked. Native Safari and native ChatGPT panel rendering were not retested for this infrastructure change.
