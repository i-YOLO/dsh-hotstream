import {clearSnapshots} from './aihot/lib/restore.ts';
import {SourcePanel} from './aihot/native/SourcePanel.tsx';
import type {} from '@deepseek-ai/dsh-client-ui-theme/client';
import {mountStyles} from './styles.ts';
/** Mount generated Remote contributions before activating their UI consumer. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-gateway/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { brandString } from '@deepseek-ai/dsh-brand';
import {createElement} from 'react';
import { IconFlame } from './aihot/components/icons.tsx';
import remoteContribution from 'dsh-hotstream-host/remote';
import { HotstreamViewController } from './controller.ts';
import { Panel } from './Panel.tsx';
import {type NewsProps} from './NewsPanel.tsx';
import {NewsViewController} from './news-controller.ts';
import { zh, en, uiZh, uiEn, type LocaleKey } from './locales.ts';

declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { hotstream: LocaleKey; } }
export const inject = ['remote'];
const PANEL_ID = brandString<MainPanelId>('hotstream');

function applyUi(ctx: Context): void {
 ctx.effect(()=>{
  const stopStyles=mountStyles();
  ctx.effect(() => ctx.locale.register('hotstream', { zh:{...zh,...uiZh}, en:{...en,...uiEn} }), 'hotstream: locale');
  const t = ctx.locale.bind('hotstream');
  const controller = new HotstreamViewController(ctx);
  const face = controller.face();
  const news=new NewsViewController(ctx,text=>face.discuss(text,t('noWorkspace'),t('draftBlocked')));
  const stopTheme=ctx.inject(['theme'],child=>{news.setHostScheme(child.theme.getTheme().active.colorScheme);child.on('theme/change',snapshot=>news.setHostScheme(snapshot.active.colorScheme));});
  const rawNewsFace=news.face();
  const newsFace={...face,...rawNewsFace,hooks:{...face.hooks,...rawNewsFace.hooks}};
  const MountedNewsPanel=(props:NewsProps)=>createElement(SourcePanel,props);
  let closed=false;const registrations=new Set<()=>void>();
  const register=(create:()=>()=>void)=>{if(closed)return()=>{};const dispose=create();registrations.add(dispose);return()=>{registrations.delete(dispose);dispose();};};
  const stopMain=ctx.slots.inject('main', () => register(()=>ctx.slots.register({ name: 'main', key: PANEL_ID, locale: 'hotstream', inject: () => newsFace }, MountedNewsPanel)));
  const stopSidebar=ctx.slots.inject('sidebar.panellist', () => register(()=>ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: () => t('entry'), locale: 'hotstream' }, IconFlame)));
  const stopConnection=ctx.on('connection/reset', ()=>news.reconnect());
  return async()=>{closed=true;await stopTheme.dispose();stopStyles();clearSnapshots();news.dispose();controller.dispose();stopConnection();stopMain();stopSidebar();for(const dispose of registrations)dispose();registrations.clear();};
 },'hotstream: mounted news UI');
}

/** @param ctx - browser Cordis context. */
export async function apply(ctx: Context): Promise<void> {
  await ctx.remote.$mount(remoteContribution);
  ctx.plugin({ name: 'hotstream-ui', inject: ['slots', 'locale', 'layout', 'remote.hotstream', 'sessions', 'workspaces', 'conversation', 'uiWorkspace'], apply: applyUi });
}
