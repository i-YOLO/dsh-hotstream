/** React-free Client controller; components receive framework-bound data and callbacks. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-gateway/client';
import type {} from '@deepseek-ai/dsh-api-session-controller/client';
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from 'dsh-hotstream-host/remote';
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { HostSnapshot } from 'dsh-hotstream-contracts';

export interface ViewState {
  snapshot: HostSnapshot | null;
  busy: boolean;
  error: string | null;
  handoffDone: boolean;
  oldDraftPreserved: boolean | null;
}
export interface ViewFace {
  readonly hooks: { readonly diagnostics: ObservableSnapshot<ViewState> };
  readonly refresh: () => void;
  readonly storageProbe: () => void;
  readonly modelProbe: () => void;
  readonly discuss: (text: string, noWorkspace: string, draftBlocked: string) => void;
}

export class HotstreamViewController {
  readonly state = createSnapshotStore<ViewState>({ snapshot: null, busy: false, error: null, handoffDone: false, oldDraftPreserved: null });
  private readonly lifetime = new AbortController();

  constructor(private readonly ctx: Context) {}

  face(): ViewFace {
    return {
      hooks: { diagnostics: this.state },
      refresh: () => { void this.load().catch(error=>{
        if(!this.lifetime.signal.aborted&&this.state.getSnapshot().snapshot?.diagnosticsEnabled)this.state.update(draft=>{draft.error=error instanceof Error?error.message:String(error);});
      }); },
      storageProbe: () => { void this.run(async () => {
        const result = await this.ctx.remote.hotstream.probeStorage({ commandId: crypto.randomUUID() });
        if (!result.ok) throw result.error;
        await this.load();
      }); },
      modelProbe: () => { void this.run(async () => {
        const result = await this.ctx.remote.hotstream.probeModel({ commandId: crypto.randomUUID() });
        if (!result.ok) throw result.error;
        await this.load();
      }); },
      discuss: (text, noWorkspace, draftBlocked) => { void this.run(async () => {
        const workspace = this.ctx.workspaces.list.getSnapshot().items[0];
        if (workspace === undefined) throw new Error(noWorkspace);
        const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
        const previousIds = this.ctx.sessions.list.getSnapshot().ids.filter(id => this.ctx.sessions.retainInfo(id).getSnapshot().referenceCount > 0);
        const previousId = previousIds.length === 1 ? previousIds[0] : undefined;
        const previous = previousId === undefined ? undefined : this.ctx.sessions.retain(previousId, { source: 'controllerOperation', signal: navigation });
        let oldState: ReturnType<ReturnType<typeof this.ctx.conversation.input.for>['state']['getSnapshot']> | undefined;
        try {
        if (previous !== undefined) {
          await previous.ready;
          oldState = this.ctx.conversation.input.for(previous.binding.ctx).state.getSnapshot();
        }
        const sessionId = await this.ctx.sessions.create({ workspaceId: workspace.workspaceId });
        if (sessionId === previousId) throw new Error(draftBlocked);
        navigation.throwIfAborted();
        const reference = this.ctx.sessions.retain(sessionId, { source: 'controllerOperation', signal: navigation });
        try {
          await reference.ready;
          navigation.throwIfAborted();
          const input = this.ctx.conversation.input.for(reference.binding.ctx);
          const state = input.state.getSnapshot();
          if (state.draft !== '' || state.attachmentIds.length > 0 || state.occurrences.length > 0 || state.phase !== 'plain') throw new Error(draftBlocked);
          input.setDraft(text);
          this.ctx.uiWorkspace.openSession(sessionId);
          const after = previous === undefined ? undefined : this.ctx.conversation.input.for(previous.binding.ctx).state.getSnapshot();
          this.state.update(draft => {
            draft.handoffDone = true;
            draft.oldDraftPreserved = oldState === undefined || after === undefined ? null : oldState.draft === after.draft && JSON.stringify(oldState.attachmentIds) === JSON.stringify(after.attachmentIds) && JSON.stringify(oldState.occurrences) === JSON.stringify(after.occurrences);
          });
        } finally { reference.release(); }
        } finally { previous?.release(); }
      }); },
    };
  }

  async load(): Promise<void> {
    const result = await this.ctx.remote.hotstream.status();
    if (!result.ok) throw result.error;
    if (this.lifetime.signal.aborted) return;
    this.state.update(draft => { draft.snapshot = result.value; });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.lifetime.signal.aborted || this.state.getSnapshot().busy) return;
    this.state.update(draft => { draft.busy = true; draft.error = null; });
    try { await action(); }
    catch (error) {
      if (!this.lifetime.signal.aborted) this.state.update(draft => { draft.error = error instanceof Error ? error.message : String(error); });
    } finally {
      if (!this.lifetime.signal.aborted) this.state.update(draft => { draft.busy = false; });
    }
  }

  dispose(): void { this.lifetime.abort(new Error('Hotstream Client disposed')); }
}
