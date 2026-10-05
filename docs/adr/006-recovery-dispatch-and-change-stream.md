# Frozen dispatch, per-attempt evidence and plugin change streams

The target remains DSH Desktop 0.2.0-rc.2 / Cordis 4.0.4. Existing migration 001 is immutable; additive migration 002 preserves its checksum and adds attempt request/response/audit metadata, immutable resolved dispatch plans, clear draining state, independent data revision and module generations.

A received auxiliary response is persisted before business processing. Audit settlement is recoverable by reopening the plugin-owned Session through the public SessionPersistence writer interface, checking the exact request/settlement identities and appending only the missing event at the observed next sequence. No recovery operation dispatches a model. DSH normalizes adapter failures into terminal finish chunks; HTTP rejection, cancellation and unknown transport outcomes are classified only after retaining those chunks.

Clear durably advances the epoch before cancellation/draining. Late evidence can be archived against its original attempt but cannot commit business data. Restart finishes an interrupted deleting state. Protected payment/audit evidence and the monotonic control record are separate from ordinary news/log cleanup.

The target public Typert model supports stream mode and final AbortSignal cancellation. The external generator adapter now emits those descriptors using the public FaceModelEmitter, retaining strict per-item DTO codecs. A plugin-owned watch emits an initial baseline and coalesced affected scopes; listening is read-only and never initializes the database or starts business work. Configuration CAS revision and data revision are separate.

Client style tags follow the target module owner and deduplication contract. No private upstream imports, host database access or global signal handlers are introduced. Native revalidation and regression records are kept separately from this design decision.
