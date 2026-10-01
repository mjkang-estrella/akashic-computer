---
name: local-fleet
description: Open Akashic Computer or delegate work to the user's independently running LAN model and read-only fleet agent.
---

Use open_workspace when the user wants independent local conversations or device health. The panel owns its own messages, sessions, and polling. Do not narrate or poll panel interactions.

For an explicit request to delegate, call delegate_task with a concise task-specific brief and a new idempotency key. Return the job ID. The local agent can inspect enrolled devices and the configured model, but cannot run arbitrary commands, edit files, or change services.

Read get_task_status when the user asks for progress. Read get_task_result only when the user wants that result in the current conversation. Do not transfer conversation history or other local sessions to the local model. Never silently substitute a cloud model.

The controller must run on this computer. A local install does not make it available in cloud ChatGPT or on other devices. Report connection failures rather than inventing health observations.
