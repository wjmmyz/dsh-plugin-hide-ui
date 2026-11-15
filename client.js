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
     * The sidebar renders each panel as `div > button > span(icon)`, and our
     * marker replaces the icon, so the row is the only `div` with a direct
     * `button` child that carries the marker. Anchoring on our own node keeps
     * the rule independent of generated class names and of the row's label.
     */
    const ROW_STYLE = `div:has(> button [${ROW_MARK}]){display:none !important}`

    /**
     * The hidden Plugins cell: draws no icon and carries the rule above.
     * @returns the marker element plus its scoped style.
     */
    function HiddenPanelIcon() {
      return h(React.Fragment, null,
        h('span', { [ROW_MARK]: '', hidden: true }),
        h('style', null, ROW_STYLE))
    }

    /** Restores one replaced descriptor; used for every patch we install. */
    const restorers = new WeakMap()

    /**
     * Wrap `remote.agentPresets.list` so callers receive the roster without the
     * built-in presets.
     *
     * `list` is an own accessor property of the namespace service (the gateway
     * installs one getter per Remote method), so the wrapper replaces that
     * descriptor instead of assigning: a plain assignment would hit a
     * getter-only property. The original descriptor is kept and put back on
     * disposal, which restores the shipped method exactly.
     * @param remote - the Client `ctx.remote` service.
     * @returns a disposer restoring the replaced descriptor.
     */
    function filterAgentPresets(remote) {
      const namespace = remote?.agentPresets
      if (namespace === undefined) return () => {}
      if (restorers.has(namespace)) return restorers.get(namespace)
      const descriptor = Object.getOwnPropertyDescriptor(namespace, 'list')
      if (descriptor === undefined || typeof descriptor.get !== 'function') return () => {}

      const original = (...args) => descriptor.get.call(namespace)(...args)
      const wrapped = async (...args) => {
        const result = await original(...args)
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

      const dispose = () => {
        restorers.delete(namespace)
        if (Object.getOwnPropertyDescriptor(namespace, 'list') !== undefined) {
          Object.defineProperty(namespace, 'list', descriptor)
        }
      }
      restorers.set(namespace, dispose)
      Object.defineProperty(namespace, 'list', {
        configurable: true, enumerable: true, writable: true, value: wrapped,
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
