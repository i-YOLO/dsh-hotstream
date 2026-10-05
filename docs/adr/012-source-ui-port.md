# AIHOT source UI on the native Desktop

The approved alpha.3 UI uses the complete AIHOT cc66cceb snapshot. Source components retain their DOM, visual values and presentation algorithms. `upstream/UI_SOURCE_MAP.json` freezes every copied source and asset hash. Newer upstream main removed retained v1 modules and is not the migration baseline.

Presentation source lives in the Client's `aihot` tree. Its navigation, local state, data loading, theme ownership and scroll objects are native adapters. React remains the host's shared React 18. Public Remote DTOs remain explicit and strictly validated; read projections never start collectors or models. The existing database and migration ledger are retained.

The upstream utility styles are mechanically converted into a checked-in CSS Module using the same upstream compiler as a development conversion tool. The converter runs outside the shipped plugin; no Tailwind runtime, preflight, global stylesheet or dependency is installed with the candidate. This preserves exact utility values while using DSH's CSS Module and effect-owned stylesheet model. Generated selectors and custom properties are namespaced, and breakpoints refer to the Hotstream container. Components and assets are not reconstructed from screenshots.

The user selected AIHOT light as the default; upstream dark is retained. Palette tokens belong to the plugin theme owner, scoped to its root and portals. `ctx.theme.getTheme()` and `theme/change` are only read for the follow-host choice. No global DSH theme or document palette is changed. Native menus and dialogs retain DSH's interaction and material contracts.

Source strings use the plugin locale adapter; remaining English coverage is tracked in the UI acceptance record. Native reading and management commands retain Publication, permissions, idempotency, revisions and draft protections. Package/visual acceptance is recorded separately from old alpha.2 evidence.

## Reading detail and full-text parity

The source flag is preserved: fetched text is not automatically readable text. `uiArticle` distinguishes source-disabled, summary-only, unavailable and full bodies through the same Publication projection. The ThinkingBox comparison exposed that the public seed disables every default RSS source's full text; this explains the local short summary despite a complete stored body. User-confirmed source changes use the normal revisioned command. The subsequent request to enable all default RSS full-text flags is recorded in ADR 013; historical migrations remain unchanged.

Article images retain their original positions as inert approved indexes. The user's later automatic-loading request is implemented by a plugin-scroll observer with a 600px margin and two concurrent Host media/Attachment reads. Leaving the article cancels its reads; failures offer retry. Every Host cache hit rechecks the current Publication, revision and image index. Generated heading anchors are local to the plugin scroll container. Source body scripts, styles and remote media tags are not injected.

A translation-only rerun preserves the existing editorial run and grouping. It is command-idempotent and requires current selected, permitted full text. Full-text-only source edits no longer enqueue unrelated event digest work, because the digest's permitted summary inputs did not change.

The official target's optional service contract requires retaining `ctx.get('attachments')` and using that returned service. Checking presence with `get` and subsequently dereferencing `ctx.attachments` still violates Cordis access rules. The media path now uses the captured public service; actual five-image Desktop gateway verification is recorded separately from simulated tests.

## Blank-page recovery and responsive ownership

The actual BootLoops article exposed a React render error: passing children to a `br` void element unmounted the reading panel. The inert renderer now emits `br` and `hr` without children. A page error boundary keeps the navigation mounted and provides retry and return actions. The exact article and both automatic images were then verified in the official Desktop; this is distinct from the SSR regression check.

The scoped theme and native layout must share one container identifier. CSS Modules keeps classes and animations hashed, but disables per-file container-name hashing for the explicit `dsh-hotstream` name. Otherwise layout rules query a different container from the one established by the source theme. This restores narrow-window report archive folding and native mobile navigation without global viewport rules. Hash-only reading links scroll within the owned panel and never create a new application route.

Watch refresh revalidates the currently loaded timeline window through Publication while retaining folded dates and scroll position. Article marks are kept across loaded pages and serialized per article; bookmarking does not trigger foreground loading. Opening an article from a report also records its read state, with duplicate read commands suppressed.
