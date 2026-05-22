# Pokemon GO Type Network

This folder contains the maintainable version of the canvas app.

## Structure

```text
modular/
  index.html
  css/
    styles.css
  js/
    app.js
    data/
      type-chart.js
    services/
      type-data-service.js
  README.md
  AGENTS.md
```

## File Responsibilities

- `index.html`: UI shell, canvas element, and script load order.
- `css/styles.css`: all visual styles and responsive breakpoints.
- `js/app.js`: canvas rendering, interaction handling, animation loop.
- `js/data/type-chart.js`: static Pokemon GO type data and constants.
- `js/services/type-data-service.js`: data-access layer that converts raw data into the chart the app consumes.

## Why This Structure Helps

- Static data is no longer mixed with rendering logic.
- Future database or API integration can be added in `js/services/` without rewriting the canvas engine.
- New AI tools or developers can quickly find where to change data, visuals, and behavior.

## Features

- **Defender mode** (🛡️): hover or click a type to see every incoming attack and its multiplier. Click a second type to fuse a dual-type center defender with combined multipliers.
- **Attacker mode** (⚔️): hover or click a type to see every type it hits super-effectively (×1.6 / ×2.56). Click a second type for dual-attacker coverage — shared targets show spiral Bezier lines, solo hits show straight lines.
- Self-referential effectiveness (e.g. Dragon→Dragon ×1.6) shown as loop links on the ring node.
- Toggle between modes using the **🛡️ Defender / ⚔️ Attacker** tabs at the bottom-right.

## Current Data Flow

1. `index.html` loads the data file first.
2. `type-data-service.js` builds the type chart from the raw matchup data.
3. `app.js` consumes the service output and renders the network.

## Future Database Integration

Recommended next step:

1. Keep `js/data/type-chart.js` as the fallback local seed data.
2. Add a new service such as `database-type-data-service.js` or `api-type-data-service.js` under `js/services/`.
3. Let `app.js` decide which service to use based on environment or configuration.
4. Keep the rendering contract stable: the app should still receive `typeOrder`, `typeData`, `pulseStyles`, and `typeChart`.

## Run

Open `modular/index.html` in a browser.

## Publish To GitHub Pages

This repo now includes a workflow at `.github/workflows/deploy-modular-pages.yml` that publishes the `modular/` folder as the website.

1. Create an empty GitHub repository.
2. Add the remote locally.
3. Push this project to `main` or `master`.
4. In GitHub, open **Settings > Pages** and keep **Source** on **GitHub Actions** if GitHub asks.
5. Wait for the **Deploy Modular To GitHub Pages** workflow to finish.

Example commands:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin master
```

After deployment, the site URL will be:

```text
https://YOUR_NAME.github.io/YOUR_REPO/
```

## AI Quick Context

- The app uses plain HTML, CSS, and vanilla JavaScript only.
- There are no external libraries or build tools.
- If you need to change matchup values, edit `js/data/type-chart.js`.
- If you need to change where data comes from, edit or add files in `js/services/`.
- If you need to change interaction or canvas drawing, edit `js/app.js`.
