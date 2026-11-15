# @wjmmyz/dsh-plugin-hide-ui

English | [中文](README.zh.md)

A DeepSeek Harness bundle that removes two kinds of clutter from the Web GUI:

- the **Plugins** entry in the left sidebar's global panel list;
- the **built-in agent presets** (Standard mode, PTC mode, Minimal mode, Creator
  mode) from the new-session preset chip, the Settings → Agent presets section,
  and the session header label.

Custom presets you add yourself stay visible. Sessions that already run a
built-in preset keep running it — the plugin filters what the pickers offer, it
does not remove declarations from the Host.

## What it changes

| Surface | Effect |
|---|---|
| Left sidebar → global panel rows | The Plugins row is gone. The other panel rows, the Workspaces/Sessions browser, New Session and Settings are untouched. |
| New-session preset chip | Lists only presets that are not built-in. Hidden when no custom preset is left. |
| Settings → Agent presets | The Built-in group disappears; the Custom group and its Creator entry are unchanged. |
| Session header preset label | Stops rendering when the session runs a built-in preset. |

The Plugins page itself is not disabled. Any other entry point continues to
work, and you can still reach it — for example the More menu lists only
unpinnable panels, so with this bundle installed the sidebar simply has no
Plugins row.

## Why these two mechanisms

The Plugins row is the one panel row the sidebar pins unconditionally: it never
enters the More menu's pin list, so it cannot be unpinned from the UI. This
bundle registers its own occupant into the same `sidebar.panellist` cell, which
replaces that row's icon renderer with one that draws nothing.

The preset roster is served to the browser by `remote.agentPresets.list()`.
Every preset surface reads it through one shared helper, so wrapping that method
while the plugin is enabled hides the built-in entries everywhere at once,
without a reload and without touching the Host's declarations.

## Install

Install the bundle into your DSH profile, then enable it:

```sh
dsh plugin install @wjmmyz/dsh-plugin-hide-ui
```

Or, in the Web GUI, open **Plugins** → **Add plugin** and give the package name
or a local directory. Restart the app once so the browser bundle is loaded, then
open a new session.

## Disable

Turn the bundle off in **Plugins**, or remove it. Both hiding rules are
registered as plugin effects, so disabling restores the shipped behavior; no
Host restart and no clearing of stored state is needed.

## Limitations

- The sidebar rule is keyed to the shipped panel id `plugins`. If a future DSH
  release renames that panel, the row reappears until this bundle is updated.
- A preset counts as built-in when its id is `standard`, `ptc`, `minimal` or
  `cordis` **and** the declaration publishes no name. That is how the shipped
  packages mark their own presets; a user declaration that reuses one of those
  ids and names itself is treated as custom and stays visible.
- The plugin only affects the browser UI. `dsh --dump-config`, the CLI, and
  sessions started by other means are unaffected.

## License

MIT
