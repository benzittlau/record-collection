# Record collection

An interactive photographic record room built from family photographs. Browse five original boxes, pull out an album, turn its sleeve over, and listen through verified Spotify album links.

Run `npm run dev`, then open <http://localhost:4173>. Run `npm run check` to validate the app, catalog, and photo projections. Node.js and Python 3 are required; there are no npm dependencies.

- `site/dist/`: the working website and its image assets.
- `site/research/`: catalog evidence, photo calibration, and review notes.
- `site/scripts/`: catalog and image preparation utilities.
- `IMG_3568.HEIC`–`IMG_3573.HEIC`: untouched source photographs.
- `reference/`: photographic references used during research.
- `visuals/`: generated room images, their prompts, and native browser previews.

See [the application documentation](site/README.md) for catalog details, source limitations, image projection, and playback behavior.

This workspace is the primary GitHub repository. The ignored `.sites-publish/` directory retains the separate Sites publishing checkout and its history. Sync the contents of `site/` into that checkout before using the Sites source helper; preserve its `.git` directory. The tracked `site/.openai/hosting.json` identifies the existing private hosted site. Repository and hosting credentials are never stored in source.
