# Learning routes

The first three routes reflect Dzinh's stated current interests: building post trained time series forecasting models, reading *Practical Statistics for Data Scientists*, and getting better at climbing slab. Their checkpoints are focus prompts and next questions, with nothing marked complete. The fourth route documents four implemented parts of this site. It does not claim unrelated study topics, climbing grades, book chapters, or personal achievements.

`index.html` is the content source. Every route and hold is a native link, so the full set of notes remains readable with JavaScript disabled. `learning.js` selects a single route and note and adds arrow-key navigation, previous/next buttons, a shareable URL fragment, and a polite announcement. No progress is saved in the visitor's browser.

To update a checkpoint:

- Edit its `.learning-note` article and matching `.learning-hold` label in `index.html`.
- Keep the article's `id`, the hold's `href`, and `data-checkpoint` identical.
- Use `data-state="complete"` for completed work or `data-state="in-progress"` for current work. Update the accessible completion label inside the hold and the note's visible status as well.
- The script derives route progress from the authored hold states. Update the initial static progress labels and progress width too, so the no-JavaScript page agrees.
- If adding a checkpoint, update the visible note numbering, `aria-label` on the hold navigation, static route totals, and the map path/positions. Keep hold targets at least 44px and separated on a 320px viewport.

To add a route, copy a `[data-learning-route]` section and give it a unique `id`, `data-route-name`, heading ID, checkpoint IDs, and article heading IDs. Add a matching native link in `.learning-route-picker` in the same order. The JavaScript initializes all route sections and derives overall totals. Update the initial static totals too so the page agrees without JavaScript.
