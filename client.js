/**
 * Hide UI — browser half.
 *
 * Three independent rules, each owned by a different shipped surface. They are
 * installed in separate `ctx.inject` scopes so one failing surface cannot
 * cancel the others.
 *
 * 1. The **Plugins** row of the left sidebar. Its row list comes from the
 *    `sidebar.panellist` slot, and the sidebar deliberately pins that one
 *    panel: `FIXED_PANEL_ID` bypasses the unpin list and the More menu, so no
 *    UI path removes it. We register into the same `sidebar.panellist` cell (a
 *    re-registration wins the cell), render a marker instead of an icon, and
 *    carry one scoped style rule that collapses the row containing the marker.
 *    The rule lives inside our own component, so React removes it with the row.
 *
 * 2. The **built-in preset rows** of the new-session chip, Settings → Agent
 *    presets, and the session-header label. All of them read one roster from
 *    the Host through `remote.agentPresets.list`; wrapping that method for our
 *    lifetime hides the built-in entries everywhere at once. The Host keeps its
 *    own declarations, so sessions already running a built-in preset keep
 *    working. Two shipped features read the same roster to decide whether
 *    Creator mode exists — the Settings "create a preset with the agent" entry
 *    and the Plugins page's "let the agent create a plugin" row — so those IDs
 *    stay in the roster by default; `keepCreatorEntries` controls that.
 *
 * 3. Nothing else. The plugin touches no Host state, writes no storage, and
 *    requests no network access.
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

    /**
     * IDs the shipped UI reads as "Creator mode is available". Filtering them
     * out of the roster would disable the Settings creator entry and the
     * Plugins page's create-plugin row, which is a feature loss rather than the
     * requested cleanup, so they stay unless config turns that off.
     */
    const CREATOR_IDS = new Set(['cordis'])

    /** Marks the panel row this plugin hides; the rule below keys on it. */
    const ROW_MARK = 'data-hide-ui-panel-row'

    /**
     * Collapses the sidebar row that contains our marker.
     *
     * The sidebar renders its global panels as `<nav> > div > button > span(icon)`,
     * and our marker takes the icon's place. Two deliberate choices make the
     * rule survive markup this plugin does not own:
     *
     * - `nav > div` pins the row to a direct child of the navigation landmark
     *   instead of assuming what sits between the row and the button (the
     *   shipped button is wrapped in a Tooltip, whose own elements may change).
     * - `:has()` reaches upward from the only node we do own. DSH already styles
     *   these rows with `:has(:focus-visible)`, so the selector is supported
     *   wherever the sidebar itself works.
     */
    const ROW_STYLE = `nav > div:has([${ROW_MARK}]){display:none !important}`

    /**
     * The replacement occupant for the Plugins cell: draws no icon, and carries
     * the rule that collapses the row it sits in.
     * @returns the marker element plus its style.
     */
    function HiddenPanelIcon() {
      return h(React.Fragment, null,
        h('style', { dangerouslySetInnerHTML: { __html: ROW_STYLE } }),
        h('span', { [ROW_MARK]: '', hidden: true }))
    }

    /** Installers keyed by the namespace they patched, so remounting is idempotent. */
    const restorers = new WeakMap()

    /**
     * Drop the built-in rows from one roster result, or return it unchanged.
     * @param {object} result - a `RemoteResult` for `agentPresets/list`.
     * @param {boolean} keepCreator - keep the ids the shipped UI reads as Creator mode.
     * @returns {object} the same result, or a copy without the hidden presets.
     */
    function withoutBuiltIns(result, keepCreator) {
      if (result === null || typeof result !== 'object' || result.ok !== true) return result
      const value = result.value
      if (value === null || typeof value !== 'object' || !Array.isArray(value.presets)) return result
      const presets = value.presets.filter((row) => {
        if (typeof row?.id !== 'string' || !BUILT_IN_PRESETS.has(row.id)) return true
        // A declaration that names itself is a user override of a built-in id.
        if (row.name !== undefined) return true
        return keepCreator && CREATOR_IDS.has(row.id)
      })
      if (presets.length === value.presets.length) return result
      return { ...result, value: { ...value, presets } }
    }

    /**
     * Wrap `remote.agentPresets.list` so callers receive the roster without the
     * built-in presets.
     *
     * `list` is an own accessor on the namespace service: the gateway installs
     * one getter per Remote method, and that getter mints a closure bound to the
     * accessing context. So the wrapper is an accessor too — it runs the original
     * getter against the same receiver on every access, preserving the gateway's
     * per-caller binding, and only filters the settled result. Disposal puts the
     * original descriptor back, restoring the shipped method exactly.
     * @param {object} remote - the Client `ctx.remote` service.
     * @param {boolean} keepCreator - keep the ids the shipped UI reads as Creator mode.
     * @returns a disposer restoring the replaced descriptor.
     */
    function filterAgentPresets(remote, keepCreator) {
      const namespace = remote?.agentPresets
      if (namespace === undefined) {
        console.warn('[hide-ui] remote.agentPresets is unavailable; built-in presets stay visible')
        return () => {}
      }
      if (restorers.has(namespace)) return restorers.get(namespace)
      const descriptor = Object.getOwnPropertyDescriptor(namespace, 'list')
      if (descriptor === undefined || typeof descriptor.get !== 'function') {
        console.warn('[hide-ui] remote.agentPresets.list is not the expected accessor; built-in presets stay visible')
        return () => {}
      }

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
              ? pending.then(value => withoutBuiltIns(value, keepCreator))
              : withoutBuiltIns(pending, keepCreator)
          }
        },
      })
      return dispose
    }

    return {
      // Only the sidebar service gates the whole plugin. The preset rule needs
      // `remote.agentPresets`, which Cordis requires the code to declare before
      // it may read the property — but declaring it here would tie the sidebar
      // rule to the preset service, so that rule injects it in its own scope.
      inject: ['slots'],
      apply(ctx, config) {
        const options = config ?? {}
        // Creator mode is hidden by default: it is one of the built-in presets.
        // Opting back in keeps it in the roster, which is what the shipped
        // Settings creator entry and the Plugins page create-plugin row read.
        const keepCreator = options.keepCreatorEntries === true

        // Rule 1: independent of every Remote namespace.
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'plugins',
          order: 0,
        }, HiddenPanelIcon)), 'hide-ui: hide the Plugins sidebar row')

        // Rule 2: its own scope, so a missing preset service cannot cancel the
        // sidebar rule and vice versa.
        ctx.inject(['remote', 'remote.agentPresets'], (scope) => {
          scope.effect(() => filterAgentPresets(scope.remote, keepCreator), 'hide-ui: hide built-in agent presets')
        })
      },
    }
  },
})
