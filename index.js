/**
 * Host half of the Hide UI bundle.
 *
 * All behavior lives in the browser half: hiding a navigation row and the
 * built-in preset cards are Client-side rendering decisions, and the Host
 * mutation surface (`sidebar.panellist`, the preset roster) belongs to the
 * shipped packages. This entry exists so the bundle occupies a Loader row and
 * can be enabled, disabled, and configured like any other plugin.
 */
export function apply() {}
