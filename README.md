# openrig-prime-agent-adapter

Community runtime adapter that lets [OpenRig](https://openrig.dev) drive
[prime-agent](https://github.com/) REPL seats through tmux.

`runtime: prime-agent` seats launch a prime-agent session in the seat pane,
receive startup guidance via `send_text`, read skills from `.agents/skills/`
in the seat's working directory, and report readiness from TUI pane
heuristics — the same contract OpenRig's built-in claude-code/codex adapters
follow.

## Prerequisites

- `@openrig/cli` **0.6.x** (tested on 0.6.11), daemon installed globally
- `prime-agent` launcher on `PATH` (interactive REPL; `--model` / `--thinking` supported)
- `tmux` (OpenRig requirement)

## Install

```bash
git clone <this-repo> && cd openrig-prime-agent-adapter
./install.sh          # patches your @openrig/cli dist in place (backs up first)
rig ps                # restart your rig; prime-agent seats now launch
```

`install.sh` is idempotent: it locates the global `@openrig/cli` dist via
`npm root -g`, backs up `startup.js`, copies `adapters/prime-agent-adapter.*`,
and applies a 3-anchor patch to `startup.js` (import + construct + both
runtime-adapter registry maps). Re-run after every `npm i -g @openrig/cli`
upgrade.

```bash
./uninstall.sh        # restores the backup
```

## Usage

Point any seat at the runtime in a rig spec:

```yaml
pods:
  - id: ops
    members:
      - id: general-task
        agent_ref: local:agents/general-worker
        runtime: prime-agent
        model: your-model-id          # passed to prime-agent --model
        cwd: /path/to/repo
        restore_policy: resume_if_possible
```

Startup files with `delivery_hint: send_text` are typed into the REPL; files
under `.agents/skills/<id>/SKILL.md` are discovered automatically.

## v1 limitations

- No fork support (`forkSource` rejected)
- No native resume tokens — seat relaunches fresh (OpenRig reconciler may
  fresh-prime after host reboot)
- Readiness detection is pane-heuristic (status bar / shell prompt patterns)
- Skill projection is a no-op: prime-agent reads `.agents/skills/` itself

## Layout

```
adapters/prime-agent-adapter.js      # the adapter (drop-in for dist/adapters/)
adapters/prime-agent-adapter.d.ts
scripts/patch-startup.mjs            # idempotent startup.js patcher
install.sh / uninstall.sh
examples/kernel-prime.yaml           # minimal rig spec
```

## License

MIT — see [LICENSE](LICENSE).
