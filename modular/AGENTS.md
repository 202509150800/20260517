# AI Working Notes

This file is for AI coding agents and automation tools.

## Project Summary

- This is a browser-only Pokemon GO type network visualizer.
- It uses one canvas and a small HTML overlay.
- No framework, package manager, bundler, or build step is used.

## Important Files

- `index.html`: entry page and script load order.
- `css/styles.css`: visual styling and responsive layout.
- `js/data/type-chart.js`: source of truth for static type data.
- `js/services/type-data-service.js`: current data access layer.
- `js/app.js`: rendering, interactions, and animation state.

## Editing Rules

- Keep the app runnable from `file://` without a local server.
- Prefer plain scripts over ESM imports unless the loading strategy is changed intentionally.
- Put raw matchup data in `js/data/`.
- Put database, API, or storage adapters in `js/services/`.
- Keep `js/app.js` focused on rendering and user interaction.

## Data Contract

The app currently expects access to:

- `typeOrder`
- `typeData`
- `pulseStyles`
- `maxIdleLineAlpha`
- `starDensity`
- `typeChart`
- `normalizeCombinedMultiplier(value)`

## Recommended Expansion Path

When adding a database later:

1. Create a new service in `js/services/`.
2. Make that service return the same data contract as the current one.
3. Keep the rest of `js/app.js` unchanged whenever possible.

## Safe Refactor Boundary

- Change `js/data/` when editing constants.
- Change `js/services/` when editing data source logic.
- Change `js/app.js` only when editing behavior, visuals, or event flow.