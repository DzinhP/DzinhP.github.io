# Photo field notes

The public notebook is at `/photos/`. It reads `notes.json`, which starts as an empty array because no personal photos or stories have been supplied. The page's frame illustrations are decorative SVG artwork, not photographs or published entries.

## Add a real entry

1. Create `photos/images/` and add your own photos there. Use short filenames such as `gym-session-01.webp`. Resize large files to about 1600–2000 pixels on the long edge, compress them, and remove location metadata before uploading if you do not want it published.
2. Copy the object in `note.json.example` into the array in `notes.json`. Replace every example value with real content. Remove the second image object if you only have one photo. Use commas between entries, without a trailing comma.
3. Give each entry a unique lowercase `id` with hyphens, a title, a real `YYYY-MM-DD` date, one category (`climbing`, `hackathons`, or `everyday`), and a short `paragraph`.
4. Add one or more `images`. Each needs a `src` beginning with `images/` and descriptive `alt` text. A `caption` is optional. Paths are relative to `photos/`; external image URLs are intentionally unsupported.
5. Preview the site through a local HTTP server, for example from the repository root with `python3 -m http.server 4173`, then open `http://localhost:4173/photos/`. Opening the HTML directly as a `file:` URL cannot load the JSON feed.

The notebook sorts entries newest first. It shows up to three thumbnails per entry; the photo viewer includes every image. Use the previous/next buttons, arrow keys, or a horizontal touch swipe to move through them. Escape closes the viewer. Category links can be shared with `?category=climbing`, `?category=hackathons`, or `?category=everyday`.

`note.json.example` is an authoring template only. The page never fetches it. Keep unfinished drafts out of `notes.json`; only add stories and photographs ready to be public. All text is rendered as plain text, so HTML and Markdown are not interpreted.

## Data shape

`notes.json` must contain an array of objects with these fields:

| Field | Required | Value |
| --- | --- | --- |
| `id` | Yes | Unique lowercase letters, digits, and hyphens |
| `title` | Yes | Nonempty text |
| `date` | Yes | Valid date in `YYYY-MM-DD` form |
| `category` | Yes | `climbing`, `hackathons`, or `everyday` |
| `paragraph` | Yes | Nonempty text; use `\n\n` for a paragraph break |
| `images` | Yes | One or more image objects |
| `images[].src` | Yes | Local path within `photos/images/`, written as `images/filename.webp` |
| `images[].alt` | Yes | Nonempty description of what the photograph shows |
| `images[].caption` | No | Plain text displayed below the enlarged photograph |

Malformed metadata produces a retry message instead of a partially broken notebook. Missing individual image files show a readable fallback while the story and other photos remain available.
