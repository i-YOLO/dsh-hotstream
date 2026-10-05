# Image evidence through the official attachment seam

The rc.2 LLM accepts `ImageBlock` with a durable `ImageAttachmentRef`; it does not accept the upstream provider's `image_url` blocks. Auxiliary content understanding therefore checks the exact prepared call's input modalities, fetches the first evidence image through the Host's guarded network, and uses public `ctx.attachments.saveImage` before creating the immutable request.

Official attachments are content-addressed, immutable objects. The plugin records their references in its own auxiliary Session audit and never deletes the shared attachment store during clear/uninstall. This avoids removing an object another DSH session may share. Text-only models and rejected/failed image fetches use the original text fallback. Requests still have no executable tools and are not Agent sessions.

This is a target-version integration adjustment. Native image dispatch and platform behavior must be tested before the feature is marked accepted; no real paid image-model call has been made during implementation.
