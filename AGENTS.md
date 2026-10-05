# dsh-hotstream

Product baseline: `docs/01_PRD.md` and the accepted implementation plan. This is a native DeepSeek Harness Desktop plugin; all retained news capabilities remain in v1 scope.

Before changing DSH integrations, read the target release's `docs/user/develop/`, relevant `docs/cookbook/`, `docs/architecture.*`, Cordis tutorials, package READMEs and public exports. Target DSH `0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`, Cordis `4.0.4`. Record deliberate design adjustments in ADRs. Never import private upstream source paths.

- Complete and verify M0 before migrating the full pipeline. Never describe probes, fixtures or reference SQL as a completed product.
- Installation and reading are free of news collection and model dispatch. Only explicit initialization starts business work.
- Preserve six sources, independent score slots, publication rules, event corrections, reports, topics, bookmarks, evaluations and optional modules.
- Use a plugin-owned SQLite worker and atomic durable jobs. Never access the host's private database.
- Models go through DSH LLM. Flush the exact immutable auxiliary Session audit before dispatch; persist responses before business commit. No Agent-controlled pipeline or provider SDK shortcut.
- Client components receive framework-derived props. Use official Slots, shared React/Cordis, UI primitives, locale dictionaries and CSS tokens.
- All runtime resources are effect-owned. One coordinated awaited shutdown drains requests before closing storage. Never call process.exit or install host-wide signal handlers.
- Disable and uninstall preserve data. Clear fences late responses with a durable generation and affects only the plugin namespace.
- No cloud sync, backup/restore, public Agent APIs, automatic source sync or manual whole-site collection.
- Tests use isolated data and simulated providers. Real paid service tests require explicit, scoped authorization.
- Track upstream files, destination and behavioral tests in `upstream/SOURCE_MAP.md`; report executed checks and outstanding acceptance honestly.
