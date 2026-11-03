# Scratch tools, kept

This branch is a backup, never merged and never deployed (Railway deploys `main` only). It holds what
lived only in the untracked `.tmp/` folder and on claude.ai on 2026-11-03, when the owner paused the
project.

- `.tmp/<batch>/` — the hand-written tools from each visual batch, at the paths `docs/HANDOFF.md`
  names them by. Only the scripts: the copies of `app/src` each batch compared against (`base/`,
  variant folders), captures, films and logs are left out, because git history can rebuild the copies
  and the pictures are outputs. Three one-off scripts that hard-coded a home folder were left out too.
- `design-canvas/` — the source of the "Flowers and Interactions" design canvas from claude.ai,
  as of 2026-10-22: seven boards and the index. Its pictures were claude.ai uploads and are not here,
  so the boards read as text and markup, not as rendered pages.

To use the tools again, copy them back into a checkout of `main`:

```bash
git fetch origin scratch-tools
git archive origin/scratch-tools .tmp | tar -x
```

Then refresh a batch's base before filming against it, as the handoff says, for example:
`rm -rf .tmp/solids/base && mkdir -p .tmp/solids/base && git archive HEAD app/src | tar -x -C .tmp/solids/base`.
