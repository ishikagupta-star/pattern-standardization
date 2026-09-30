# Pattern Standardization — design spec viewer

A living reference site for the team's product patterns. Each page is a
pixel-exact build of a Figma screen, shown on a fixed 1280×764 canvas, with
a **live hover inspector**: point at anything and see its real size,
padding, gap, colors and type — read straight from the rendered CSS, so it
can never drift out of sync as the page changes.

Switch between pages with the floating button in the bottom-right corner.

## Adding a new page

1. Make a folder under `pages/<your-page-id>/` with its own `index.html`
   and `styles.css` (and an `assets/` folder for images, if needed).
2. In that page's `<head>`, include the shared inspector:
   ```html
   <link rel="stylesheet" href="../../inspector.css" />
   ```
   and just before `</body>`:
   ```html
   <script src="../../inspector.js"></script>
   ```
3. Mark whatever elements are worth inspecting with a `data-spec="..."`
   attribute — a short, human-readable name. Everything else (size,
   padding, gap, colors, type) is computed automatically on hover; you
   never write those numbers by hand.
4. Add one entry to `pages.json` at the project root:
   ```json
   { "id": "your-page-id", "title": "Page Title", "subtitle": "short description", "path": "pages/your-page-id/index.html" }
   ```
5. That's it — the page appears in the floating switcher automatically.

## Local preview

```bash
python3 -m http.server 4174
```

Then open `http://localhost:4174`.
