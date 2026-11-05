# Fragment Kit migration

Pages vendors the immutable published v0.3.3 pin. Shared native modules replace copied URL/CID, Publish, QR, drafts, scheduler, offline, shell and gallery plumbing. No production build is added.

The document adapter keeps the existing hashbin-diagram v1 pages envelope, entry source duplication, file order, entry and active file. Project.validate still bounds paths, extensions, file count and text size. View-only, run-on-open and preview-page settings remain app-owned presentation flags. Existing compressed, document, source, example, CID and Publish-return URLs keep loading; writers retain the existing forms until the fleet's readers are deployed.

Publish still loads the byte-pinned SDK through an SRI module script. The original SDK integrity value remains unchanged, and substituted bytes must fail before execution. The kit handles CID verification and original transaction bytes. A small SDK wrapper preserves Pages' view/run/page choices in clientState for approved and cancelled returns. New transaction keys are prefixed; only this client's old transaction namespace is readable.

Project validation, Markdown, loop instrumentation, bundling, preview runtime, trusted host and opaque child-frame boundary remain app-owned. Cross-origin preview hosts, bounded/source/token-checked messages, storage reset, crash-safe mode and ZIP exports retain their existing contracts. The original screenshot producer remains available as gallery:pages; shared covers and filters use its verified PNGs.

The generated HashBin domain notice stays owner-generated. Canonical/recovery origins and the registered public client ID are preserved. No paid save or account/allowlist change is part of this migration.

Large projects use the pre-existing plain-envelope fragment fallback above 7,000 URL characters, so their source avoids HTTP request-line limits without introducing a new URL version. Old Pages readers already support this form. Small projects retain compressed query links.
