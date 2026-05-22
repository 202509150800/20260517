# AI Working Notes

This file is for AI coding agents and automation tools.

## Project Summary

- This is a browser-only Pokemon GO type network visualizer.
- It uses one canvas and a small HTML overlay.
- No framework, package manager, bundler, or build step is used.
- The app has two view modes: **Defender** (default) and **Attacker**, toggled via the `#modeToggle` UI.

## Important Files

- `index.html`: entry page, script load order, and all UI HTML (legend, mode toggle, reset button).
- `css/styles.css`: visual styling and responsive layout, including `.mode-toggle` / `.mode-tab` styles.
- `js/data/type-chart.js`: source of truth for static type data.
- `js/services/type-data-service.js`: current data access layer.
- `js/app.js`: rendering, interactions, animation state, and mode logic.

## Editing Rules

- Keep the app runnable from `file://` without a local server.
- Prefer plain scripts over ESM imports unless the loading strategy is changed intentionally.
- Put raw matchup data in `js/data/`.
- Put database, API, or storage adapters in `js/services/`.
- Keep `js/app.js` focused on rendering and user interaction.

## Data Contract

The app consumes the following from `createTypeDataService().getConfig()`:

- `typeOrder` — ordered array of 18 type strings
- `typeData` — `{ [type]: { name, emoji, color } }`
- `pulseStyles` — `{ [multiplier]: { label, endColor, speed, width, glow, alpha, mode } }`
- `combinedValues` — snapped multiplier values: `[2.56, 1.6, 1, 0.625, 0.39, 0.24]`
- `maxIdleLineAlpha` — baseline link opacity in idle state
- `starDensity` — number of background stars

And from the service instance:

- `typeChart` — `{ [attacker][defender]: multiplier }`
- `normalizeCombinedMultiplier(value)` — snaps a raw product to nearest `combinedValues` entry

## App State

Key fields in `state`:

- `selectedTypes: string[]` — 0, 1, or 2 selected type strings
- `hoverType: string | null` — currently hovered type
- `viewMode: "defender" | "attacker"` — current mode tab selection

## Mode System

`getMode()` returns one of five mode kinds:

| kind | trigger |
|---|---|
| `idle` | no selection, no hover |
| `single` | 1 type selected/hovered in defender mode |
| `dual` | 2 types selected in defender mode |
| `attacker-single` | 1 type selected/hovered in attacker mode |
| `attacker-dual` | 2 types selected in attacker mode |

## UI Elements

- `#modeToggle` — contains two `.mode-tab` buttons (`data-mode="defender"` and `data-mode="attacker"`)
- `#resetButton` — disabled when no selections
- `#status` — live status text panel

## Recommended Expansion Path

When adding a database later:

1. Create a new service in `js/services/`.
2. Make that service return the same data contract as the current one.
3. Keep the rest of `js/app.js` unchanged whenever possible.

## Safe Refactor Boundary

- Change `js/data/` when editing constants.
- Change `js/services/` when editing data source logic.
- Change `js/app.js` only when editing behavior, visuals, or event flow.