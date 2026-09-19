# SNU

Premium website for **Sigma Nu — Delta Theta Chapter, Knox College**: the oldest continuously running chapter of Sigma Nu in the world.

Black, white and gold, built around a real-time 3D coiled rattlesnake (the Sigma Nu serpent), with scroll-driven zooms, a curved 3D photo ring and a horizontal "Tenets" journey.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/ — upload anywhere (GitHub Pages, Netlify, Vercel)
npm run preview   # serve the built site locally
```

## Where things live

| File | What it is |
| --- | --- |
| `index.html` | All page content: hero, history, calendar, honors, members, rush form |
| `src/serpent.js` | The procedural 3D rattlesnake (three.js): coil, diamondback scale shader, head, rattle |
| `src/main.js` | Smooth scroll (Lenis), scroll animations (GSAP ScrollTrigger), house ring, menu, form |
| `src/emblem.js` | Line-art serpent drawn by the loader |
| `src/styles.css` | Design tokens, typography, layout, responsive rules |
| `public/img/` | Photos (WebP). Sources and licenses are in `public/credits.json` and the footer's "Photo credits" |

## Before going live

- **Members** (`#brothers` in `index.html`): names and portraits are placeholders. Swap in the real Executive Council.
- **Calendar** (`#calendar`): dates are a sample Fall 2026 schedule. Edit them to match the chapter's.
- **Rush form**: front-end only. Point it at a form service (Formspree, Netlify Forms, Google Forms) to receive submissions.
- **Photos**: stock images are CC0 or openly licensed. Replace them with chapter photos whenever you have them; keep `credits.json` in sync.
