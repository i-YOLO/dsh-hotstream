/** Company membership from AIHOT publication/topics.ts; material only mentioning a company is excluded. */
import {ENTITIES} from '../editorial/vocabulary.ts';
export interface TopicMembership {name:string;entityId:string|null;tags:readonly string[];}
export interface TopicMaterial {title:string;originalTitle?:string|null;tags:readonly string[];}
export const topicMembershipTags=(topic:TopicMembership):readonly string[]=>topic.entityId?['entity:'+topic.entityId]:topic.tags;
const patterns=new Map<string,RegExp>();
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function titlePattern(topic:TopicMembership):RegExp{
 const key=JSON.stringify([topic.name,topic.entityId]);const cached=patterns.get(key);if(cached)return cached;
 const entity=ENTITIES[topic.entityId??''];const names=[...new Set([topic.name,...topic.name.split('/').map(name=>name.trim()).filter(Boolean),...entity?[entity.name,...entity.aliases,...entity.otherNames??[]]:[]])];
 const pattern=new RegExp(`(?<![A-Za-z])(?:${names.map(escape).join('|')})(?![A-Za-z])`,'i');patterns.set(key,pattern);return pattern;
}
export function belongsToTopic(material:TopicMaterial,topic:TopicMembership):boolean{
 if(!material.tags.some(tag=>topicMembershipTags(topic).includes(tag)))return false;
 if(!topic.entityId)return true;
 if(material.tags.filter(tag=>tag.startsWith('entity:')).length===1)return true;
 const pattern=titlePattern(topic);return pattern.test(material.title)||pattern.test(material.originalTitle??'');
}
