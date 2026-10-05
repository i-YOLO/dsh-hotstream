/** Read-only presentation DTOs for the source UI. All results remain Publication-filtered. */
import type {Publication,Report,Json} from './runtime.ts';
export interface UiArticleRequest {id:string;}
export interface UiArticleResult {item:Publication|null;bodyState:'full'|'source-disabled'|'summary-only'|'unavailable';images:{index:number;url:string;alt:string|null}[];}
export interface UiFeedRequest {view:'selected'|'all'|'bookmarks';query:string;category:string|null;topic:string|null;channel:'all'|'news'|'x'|'firstParty';tag:string|null;limit:number;offset:number;cursor:string|null;}
export interface UiGroup {factId:string;additionalSourceCount:number;reportCount:number;}
export interface UiFeedCard {key:string;anchorAt:number;item:Publication;channel:'news'|'x';group:UiGroup|null;sameEvent:{id:string;title:string}|null;}
export interface UiFeedResult {cards:UiFeedCard[];total:number;dayCounts:{day:string;count:number}[];nextCursor:string|null;epoch:number;dataRevision:number;}
export interface UiGroupRequest {factId:string;category:string|null;channel:'all'|'news'|'x'|'firstParty';tag:string|null;limit:number;offset:number;}
export interface UiGroupResult {items:{id:string;title:string;sourceName:string;timelineAt:number;url:string}[];total:number;}
export interface UiReportIndexRequest {kind:'daily'|'weekly'|'monthly';group:string|null;limit:number;offset:number;}
export interface UiReportIndexEntry {id:string;key:string;issueNumber:number;title:string|null;count:number;historical:boolean;coverage:string;}
export interface UiReportIndexResult {items:UiReportIndexEntry[];groups:{key:string;count:number}[];total:number;}
export interface UiReportRequest {kind:'daily'|'weekly'|'monthly';key:string|null;}
export interface UiReportResult {report:Report|null;issueNumber:number|null;prev:string|null;next:string|null;index:UiReportIndexResult;readingMinutes:number;metrics:Record<string,number>;}
export interface UiGroupCache {key:string;items:UiGroupResult;}
