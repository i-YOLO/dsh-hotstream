import type {Context} from '@deepseek-ai/cordis';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import type {CredentialWriteRequest,HotstreamStore} from 'dsh-hotstream-contracts';

/** The host stores only the user's own key; saving never wakes business work. */
export async function changeCredential(ctx:Context,store:HotstreamStore,service:CredentialWriteRequest['service'],secret:string|null):Promise<void> {
  const state=await store.execute('state',{});
  if(service==='socialdata'&&state.settings?.features.codexResetMonitor)throw new Error('Pause periodic Tibo monitoring before changing SocialData credentials');
  if(secret!==null&&!secret.trim())throw new Error('API Key is required');
  await store.execute('credentialInvalidate',{service,now:Date.now()});
  try {await ctx.credentials.modifyRecord(credentialKey('hotstream',service),async()=>secret===null?undefined:{kind:'api-key',key:secret.trim()});}
  catch {throw new Error('The credential could not be saved. Your existing setting was not activated.');}
}
