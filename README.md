# @wjmmyz/dsh-plugin-hide-ui

English | [中文](README.zh.md)

A DeepSeek Harness bundle that removes two kinds of clutter from the Web GUI:

- the **Plugins** row in the left sidebar's global panel list;
- the **built-in agent presets** (Standard mode, PTC mode, Minimal mode) from the
  new-session preset chip, from Settings → Agent presets, and from the preset
  list those surfaces read.

Custom presets you add yourself stay visible, and a preset declaration that
reuses a built-in id but publishes its own name is treated as custom — it stays
too. Sessions that already run a built-in preset keep running it: the plugin
filters what the pickers offer, it does not remove declarations from the Host.

## What it changes

| Surface | Effect |
|---|---|
| Left sidebar → global panel rows | The Plugins row is gone. Other panel rows, the Workspaces/Sessions browser, New Session and Settings are untouched. |
| New-session preset chip | Lists only non-built-in presets. If nothing is left to choose, the chip is not rendered. |
| Settings → Agent presets | Standard / PTC / Minimal cards disappear from the Built-in group. |
| Session header preset label | A built-in preset that was filtered out of the roster has no display name left, so the header shows the raw preset id (for example `standard`) instead of its localized name. |

**Creator mode is hidden by default too.** It is one of the built-in presets, so it
disappears with the others. Two shipped entries decide whether to appear by
looking for the `cordis` preset in the same roster: the Settings "let the agent
help me create a preset" button and the Plugins page's "let the agent create a
plugin" row. Hiding Creator mode disables both. Set `keepCreatorEntries` to
`true` in the plugin's configuration to bring Creator mode — and those two
entries — back while keeping the other built-in presets hidden.

## Getting back to the Plugins page

This plugin hides the sidebar row that normally opens **Plugins**, so use the
other route: the sidebar's panel list ends with a **More** button (`…`, the
add-panel icon). Its menu contains **Browse other plugins**, which opens the
Plugins page. That is where you enable or disable bundles, including this one.

On a narrow window the sidebar is a drawer; open it from the header's sidebar
button first. With the sidebar fully hidden (macOS desktop), use the sidebar
button beside the window controls.

## Install

Install the bundle into your DSH profile, then enable it:

```sh
dsh plugin install @wjmmyz/dsh-plugin-hide-ui
```

Or, in the Web GUI, open **Plugins** → **Add plugin** and give the package name
or a local directory. Restart the app once so the browser bundle is loaded, then
open a new session.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `keepCreatorEntries` | `false` | Keep the Creator mode preset in the roster. Turn it on to use the Settings creator entry and the Plugins page create-plugin row, which are shown only while Creator mode is present. |

## Disable

Turn the bundle off in **Plugins** (reach it through **More** → **Browse other
plugins**, as described above), or remove it. Every hiding rule is registered as a
plugin effect, so disabling restores the shipped behavior; no Host restart and no
clearing of stored state is needed. Reload the page once so the browser half is
torn down.

## How it works

The Plugins row is the one global panel the sidebar pins unconditionally — it
never enters the More menu's pin list, so it cannot be unpinned from the UI. This
bundle registers its own occupant into the same `sidebar.panellist` cell, which
replaces that row's icon renderer, and ships one scoped rule that collapses the
row containing its marker.

The preset roster reaches the browser through `remote.agentPresets.list()`, and
every preset surface reads it through the same helper. The plugin replaces that
method's accessor for its own lifetime, so all surfaces see the filtered roster at
once without a reload and without touching the Host's declarations.

## Limitations

- The sidebar rule anchors on the shipped panel id `plugins` and on the sidebar's
  `<nav>` landmark. A future DSH release that renames either makes the row
  reappear; the preset rule is unaffected.
- A preset counts as built-in when its id is `standard`, `ptc`, `minimal` or
  `cordis` **and** the declaration publishes no name. That is how the shipped
  packages mark their own presets.
- A session already running a filtered-out preset keeps working, but its header
  label falls back to the raw id and Settings can no longer offer it as the
  default; choose a custom preset as the default instead.
- The plugin only affects the browser UI. `dsh --dump-config`, the CLI, and
  sessions started by other means are unaffected.

## License

MIT
