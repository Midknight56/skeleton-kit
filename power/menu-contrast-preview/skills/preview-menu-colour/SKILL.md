---
name: preview-menu-colour
description: Use when someone wants to try a menu colour or sky glow before editing the garden or runner theme.
---

# Try a menu colour before editing a theme

Use this to answer a design question before any theme file changes. The tool `preview_menu_contrast` reads the current theme, applies the proposed colour in memory and measures the same colour pairs as `tests/a11y/contrast.test.ts`. It writes no file.

1. Identify the game (`garden` or `runner`), the colour setting and the proposed value. The setting is `glow` or one of the eight colour names in `Theme.palette`. The value is `#RRGGBB`. `glow` also accepts `#RRGGBBAA`, where the last two digits set the opacity.
2. Call `preview_menu_contrast` once. Report each newly failing label or control with its current ratio, proposed ratio and minimum. List any failures that already existed separately.
3. If all checked pairs pass, give the count. Keep the result scoped to menu colours. Artwork drawn inside the game has separate checks.

If the tool returns an error, it names the field that is wrong. Fix that field and call again. Do not edit a theme file to try the colour.
