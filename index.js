/**
 * Host half of the Hide UI bundle.
 *
 * Hiding a navigation row and the built-in preset cards are Client-side
 * rendering decisions, and the mutation surfaces they use (`sidebar.panellist`,
 * the preset roster) belong to the shipped packages, so this entry performs no
 * Host work. It exists so the bundle occupies a Loader row and can be enabled,
 * disabled, and configured like any other plugin.
 */

/**
 * Bundle configuration, rendered as the row's form in the Plugins page.
 *
 * Declared as a plain JSON Schema so the bundle needs no build step and no
 * dependency on the Host's schema library.
 */
export const Config = {
  type: 'object',
  properties: {
    keepCreatorEntries: {
      type: 'boolean',
      default: true,
      title: 'Keep Creator mode entries',
      description:
        'Keep the Creator mode preset in the roster. The Settings "let the agent help me create a preset" entry '
        + 'and the Plugins page "let the agent create a plugin" row are shown only while it is present. '
        + 'Turn this off to hide Creator mode as well; those two entries then disappear.',
    },
  },
  additionalProperties: false,
}

export function apply() {}
