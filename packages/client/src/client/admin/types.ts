import type {NewsProps} from '../NewsPanel.tsx';
import type {NewsFace,NewsState} from '../news-controller.ts';
export type AdminFace=Omit<NewsFace,'hooks'>&{t:NewsProps['t']};
export interface AdminProps {state:NewsState;face:AdminFace;}
export interface CredentialDraftActions {isDirty():boolean;save():Promise<boolean>;discard():void;}
export type RegisterCredentialDraft=(id:string,actions:CredentialDraftActions)=>()=>void;
export const translator=(face:AdminFace)=>(zh:string,en:string)=>face.t('back')==='Back'?en:zh;
