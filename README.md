# Dzinh Pham

A personal portfolio and hub inspired by bouldering, with selected projects, writing, learning notes, and occasional updates. Built with plain HTML, CSS, and JavaScript. No dependencies or build step.

## Preview locally

From the repository folder, run:

```sh
python3 -m http.server 4173
```

Open [localhost:4173](http://localhost:4173).

## Make it yours

- Edit `index.html` for biography, projects, and links.
- Edit `styles.css` for colors, typography, and layout.
- Edit `experience.css` for the homepage's sticky header, forest-green project section, and visual accents.
- Edit `script.js` for the mobile navigation and copy-email interaction.
- Edit `route.js` for the four climbing holds' descriptions and destinations; their layout and animation are in `route.css`.
- Edit `interactions.js` and `interactions.css` for project-card tilt, section reveals, active navigation, and scroll progress. These enhancements respect reduced-motion preferences, and the core content and links work without JavaScript.
- Edit `writing/index.html` for the field notes archive, `writing/writing.css` for its layout, and `writing/writing.js` for the category filters.
- Edit `404.html` for the missing-page screen.

## The personal side of basecamp

- `/now/` is the current snapshot. Edit the four sections in `now/index.html` and update its visible and machine-readable date when the focus changes. The initial snapshot uses the supplied forecasting project, statistics book, and slab-climbing focus.
- `/learning/` is the learning map. Holds open notes, and route completion reflects the author's recorded checkpoints. Reading or clicking never changes that progress. See [the learning guide](learning/README.md) to add notes, routes, or completed checkpoints.
- `/climb/` is an optional six-move climbing game. Start explicitly, choose holds with arrow keys, and press Space or Enter to move. Mouse and touch players can select a hold and use the action beneath the wall. Restart and replay are available; there is no timer or stored score.
- `/photos/` is the photo notebook. It supports Climbing, Hackathons, and Everyday entries with multiple photographs, captions, and a short story. Add real images and metadata using [the photo guide](photos/README.md). The initial `photos/notes.json` is empty until personal photos are supplied.
- `/explore/` brings these four sections together. Homepage shortcuts and the shared navigation make them discoverable. Shared styles live in `basecamp.css`.

Headers are static HTML in each page, so keep their navigation and profile links in sync when changing them. All email links use `dzinh@berkeley.edu`.

The game logic can be checked with `node --test climb/climb.test.cjs`. Also preview new content on desktop and mobile, and check keyboard controls and links before publishing.

## Add a field note

1. Copy `writing/a-new-basecamp/index.html` into a new folder, such as `writing/my-next-note/index.html`. Keep posts one folder below `writing/` so the relative stylesheet, navigation, and script links continue to work.
2. Update the page title, description, Open Graph metadata, article title, category, date, reading time, and article body. Use `Writing`, `Learning notes`, or `Updates` as the visible category. Keep the machine-readable `datetime` and `article:published_time` values in `YYYY-MM-DD` format.
3. Add an `<article class="note-entry">` to `writing/index.html`, using the existing entry as a template. Set `data-category` to `writing`, `learning`, or `updates`, and link to the new folder. Put the newest entry first. Update the initial note count in `.filter-status` for visitors with JavaScript disabled.
4. Update the featured/latest field note on the homepage in `index.html` manually when you want to highlight the new post.
5. Preview the archive and article on desktop and mobile. Check the post link, navigation, and category filter before publishing.

The archive uses static HTML, so every post remains visible without JavaScript. With JavaScript enabled, the category buttons filter entries and preserve the selected category in the URL (for example, `/writing/?category=learning`). Categories with no posts display an empty state. Browser Back and Forward restore the selected filter.

## GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, select the branch containing this site, and use **/ (root)** as the folder. Save to publish through GitHub Pages. This repository does not require GitHub Actions or a package install.

The empty `.nojekyll` file keeps the site as plain static files. The previous site's history is preserved at `origin/main` commit `35486a2` (the starting point of this rebuild).
