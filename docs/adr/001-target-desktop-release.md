# Target the distributed Desktop release

The PRD remains the product baseline. Its DSH design pin is 0.2.1-alpha.1. On 2026-10-03, the official macOS arm64, macOS x64 and Windows x64 update feeds all distribute 0.2.0-rc.2; the local official app is the same version.

Implementation targets tag dsh-v0.2.0-rc.2, commit 639ed015397290b3745d163aafe02ffee4aa3f84, with Cordis 4.0.4. The original design pin is retained in the upstream lock for comparison. Do not use version exemptions.

The release's uiWorkspace.startSession has no prompt argument. The discussion adapter must create and retain a new Session, check its public input state, setDraft through conversation.input.for, and open it without submitting. Client artifacts use the release's lazy-CJS factory protocol. Ordered teardown must live in one awaited coordinator because Cordis may start asynchronous disposers concurrently.

The initial Node-mode probe passed node:sqlite, worker_threads and Chinese FTS5 trigram on Node 24.18.1 / SQLite 3.53.1. These probes do not establish plugin installation or M0 acceptance.
