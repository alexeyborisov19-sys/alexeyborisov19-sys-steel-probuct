# Approved IFC library upload

Upload only `SteelProdukt_BIM_Web_2026-10-14.zip` from this conversation into this
folder on branch `feat/bim-library-20261014`.

The import workflow checks the pinned SHA-256, size, exact path allowlist and
per-file checksums before adding public assets. It rejects modified archives,
source STEP files, path traversal, symlinks and extra entries. It never merges
the feature branch or deploys production. The existing Beget release workflow
remains unchanged. Do not publish the library page until assets are imported
and the site checks pass.
