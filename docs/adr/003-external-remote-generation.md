# Generate external Remote metadata with the public model emitter

The 0.2.0-rc.2 WorkspaceAnalyzer identifies Remote and TypertRemoteService origins through workspace registrations or ambient protocol declarations. With the installed npm protocol declaration face, it analyzes the Host service and DTOs but emits no invocation models. The standalone WorkspaceTypertGenerator then rejects the declared Remote exports.

The build adapter uses only published APIs: WorkspaceAnalyzer supplies canonical method/type models, remoteMethods reads the compiled controller's actual DSH decorator metadata, and FaceModelEmitter creates strict Host descriptors, codecs and Client declarations. It does not modify DSH, copy private generator code, hand-write Client method signatures, or fall back to SRC codecs.

M0 admits explicit unary public JSON DTOs only. Unexpected method signatures fail the build. Integration tests must compare emitted descriptors with actual runtime metadata and verify malformed payload rejection through the real Gateway. Extend this adapter deliberately before adding streaming, optional or cancellation parameters.
