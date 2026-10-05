/** M0 diagnostics composed with shared DSH primitives and derived slot props. */
import { useEffect } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ViewFace } from './controller.ts';
import css from './Panel.module.css';

export type PanelProps = PropsRuntime<'main'> & PropsLocale<'hotstream'> & InjectFace<ViewFace>;

export function Panel(props: PanelProps) {
  const state = props.useDiagnostics(state => state);
  const { t } = props;
  useEffect(() => { props.refresh(); }, [props.refresh]);
  const snapshot = state.snapshot;
  return <section className={css.panel} data-hotstream-panel="m0">
    <header><h1>{t('title')}</h1><p className={css.caption}>{t('milestone')}</p></header>
    <p>{t('scope')}</p>
    <div className={css.card}><strong>{t('uninitialized')}</strong><p>{t('noRequests')}</p></div>
    {snapshot !== null && <dl className={css.facts}>
      <dt>{t('runtime')}</dt><dd>DSH {snapshot.targetDshVersion} · Node {snapshot.hostNodeVersion}</dd>
      <dt>{t('sources')}</dt><dd>{snapshot.sourceCount}</dd>
      <dt>{t('newsRequests')}</dt><dd data-hotstream-news-requests="">{snapshot.newsRequests}</dd>
      <dt>{t('modelRequests')}</dt><dd data-hotstream-model-requests="">{snapshot.modelRequests}</dd>
      <dt>{t('storage')}</dt><dd>{snapshot.storage === null ? t('notRun') : `${t('passed')} · SQLite ${snapshot.storage.sqliteVersion} · ${snapshot.storage.journalMode} · FTS5`}</dd>
      <dt>{t('model')}</dt><dd>{snapshot.model === null ? t('notRun') : `${t('passed')} · ${snapshot.model.provider} / ${snapshot.model.model}`}</dd>
    </dl>}
    {snapshot?.diagnosticsEnabled === false && <p className={css.caption}>{t('diagnosticsDisabled')}</p>}
    <div className={css.actions}>
      <Button disabled={state.busy || snapshot?.diagnosticsEnabled !== true} onClick={props.storageProbe}>{t('storageProbe')}</Button>
      <Button disabled={state.busy || snapshot?.diagnosticsEnabled !== true} onClick={props.modelProbe}>{t('modelProbe')}</Button>
      <Button disabled={state.busy} onClick={() => props.discuss(t('discussMaterial'), t('noWorkspace'), t('draftBlocked'))}>{t('discussProbe')}</Button>
      <Button variant="ghost" disabled={state.busy} onClick={props.refresh}>{t('refresh')}</Button>
    </div>
    {state.busy && <p role="status">{t('busy')}</p>}
    {state.error !== null && <p className={css.error} role="alert">{t('error')}: {state.error}</p>}
    {state.handoffDone && <p role="status">{t('handoffDone')}</p>}
    {state.oldDraftPreserved === true && <p role="status">{t('oldDraftPreserved')}</p>}
  </section>;
}
