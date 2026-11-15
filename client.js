/**
 * Hide UI — browser half.
 *
 * Two independent hiding rules, each owned by a different shipped surface:
 *
 * 1. The **Plugins** row of the left sidebar. Its row list is derived from the
 *    `sidebar.panellist` slot, and the sidebar deliberately keeps that one
 *    panel fixed: `FIXED_PANEL_ID` bypasses the unpin list and the More menu,
 *    so no UI path removes it. We register into the same `sidebar.panellist`
 *    cell (a re-registration wins the cell), render a marker instead of an
 *    icon, and carry one scoped style rule that collapses the row that
 *    contains the marker. The rule lives inside our own component, so React
 *    removes it with the row and nothing leaks into the page.
 *
 * 2. The **built-in agent presets** of the new-session chip, the session
 *    header label and Settings → Agent presets. All three read one roster from
 *    the Host through `remote.agentPresets.list`; wrapping that method for our
 *    lifetime hides the built-in entries everywhere at once, without touching
 *    the Host's declarations, so sessions already running a built-in preset
 *    keep working.
 */
window.__ModuleLoader__.load({
  id: '@wjmmyz/dsh-plugin-hide-ui',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * Built-in presets shipped by the DSH deployment. A roster row counts as
     * built-in when its id matches AND it published no name — exactly how the
     * shipped packages mark their own presets. A user declaration that reuses
     * one of these ids and names itself is custom and stays visible.
     */
    const BUILT_IN_PRESETS = new Set(['standard', 'ptc', 'minimal', 'cordis'])

    /** Marks the panel row this plugin hides; the rule below keys on it. */
    const ROW_MARK = 'data-hide-ui-panel-row'

    /**
     * Collapses the sidebar row that contains our marker.
     *
     * The sidebar renders each global panel as `div > button > span(icon)` inside
     * its `<nav>` landmark, and our marker takes the icon's place. `:has()` is
     * what lets a rule reach the row when the only node we own is the icon slot;
     * scoping to `nav` keeps it off anything else that might nest a button.
     */
    const ROW_STYLE = `nav div:has(> button [${ROW_MARK}]){display:none !important}`

    /**
     * The replacement occupant for the Plugins cell: draws no icon, and carries
     * the rule that collapses the row it sits in.
     *
     * The `<style>` is part of this component, so React removes it together with
     * the row when the plugin unloads — nothing is left behind in the page.
     * @returns the marker element plus its style.
     */
    function HiddenPanelIcon() {
      return h(React.Fragment, null,
        h('style', { dangerouslySetInnerHTML: { __html: ROW_STYLE } }),
        h('span', { [ROW_MARK]: '', hidden: true }))
    }

    /** Restores one replaced descriptor; used for every patch we install. */
    const restorers = new WeakMap()

    /**
     * Drop the built-in rows from one roster result, or return it unchanged.
     * @param {object} result - a `RemoteResult` for `agentPresets/list`.
     * @returns {object} the same result, or a copy without built-in presets.
     */
    function withoutBuiltIns(result) {
      if (result === null || typeof result !== 'object' || result.ok !== true) return result
      const value = result.value
      if (value === null || typeof value !== 'object' || !Array.isArray(value.presets)) return result
      const presets = value.presets.filter((row) => {
        if (typeof row?.id !== 'string' || !BUILT_IN_PRESETS.has(row.id)) return true
        return row.name !== undefined
      })
      if (presets.length === value.presets.length) return result
      return { ...result, value: { ...value, presets } }
    }

    /**
     * Wrap `remote.agentPresets.list` so callers receive the roster without the
     * built-in presets.
     *
     * `list` is an own accessor property of the namespace service: the gateway
     * installs one getter per Remote method, and that getter mints a closure
     * bound to the accessing context. So the wrapper is an accessor too — it
     * runs the original getter against the same receiver on every access,
     * which preserves the gateway's per-caller binding, and only filters the
     * settled result. Disposal puts the original descriptor back, restoring the
     * shipped method exactly.
     * @param remote - the Client `ctx.remote` service.
     * @returns a disposer restoring the replaced descriptor.
     */
    function filterAgentPresets(remote) {
      const namespace = remote?.agentPresets
      if (namespace === undefined) return () => {}
      if (restorers.has(namespace)) return restorers.get(namespace)
      const descriptor = Object.getOwnPropertyDescriptor(namespace, 'list')
      if (descriptor === undefined || typeof descriptor.get !== 'function') return () => {}

      const dispose = () => {
        restorers.delete(namespace)
        Object.defineProperty(namespace, 'list', descriptor)
      }
      restorers.set(namespace, dispose)
      Object.defineProperty(namespace, 'list', {
        configurable: true,
        enumerable: true,
        get() {
          const call = descriptor.get.call(this)
          // Call synchronously so a synchronously-throwing Host call still
          // throws to the caller instead of turning into a rejected promise;
          // the settled value is what gets filtered.
          return (...args) => {
            const pending = call(...args)
            return pending !== null && typeof pending === 'object' && typeof pending.then === 'function'
              ? pending.then(withoutBuiltIns)
              : withoutBuiltIns(pending)
          }
        },
      })
      return dispose
    }

    return {
      inject: ['slots', 'remote'],
      apply(ctx) {
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'plugins',
          order: 0,
        }, HiddenPanelIcon)), 'hide-ui: hide the Plugins sidebar row')

        ctx.effect(() => filterAgentPresets(ctx.remote), 'hide-ui: hide built-in agent presets')
      },
    }
  },
})
