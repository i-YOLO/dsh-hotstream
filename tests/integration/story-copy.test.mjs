import {describe,it,expect} from 'vitest';
import {projectDigest} from '../../packages/storage-sqlite/lib/types/story-copy.js';
const articles=[{id:'later',sourceName:'TechCrunch',summary:'报道包含离职指控及公司回应。',timelineAt:200},{id:'earlier',sourceName:'The Decoder',summary:'报道该员工离职并发文。',timelineAt:100}];
describe('source-bound digest projection',()=>{
 it('does not infer no response when the original source contains a spokesperson response',()=>{const original='目前 OpenAI方面的回应尚未在现有报道中呈现。';const result=projectDigest(original,articles,['OpenAI spokesperson responded and described its safety measures.']);expect(result.fallback).toBe(true);expect(result.digest).not.toContain('尚未');expect(result.digest.indexOf('The Decoder')).toBeLessThan(result.digest.indexOf('TechCrunch'));expect(original).toContain('尚未');});
 it('retains an explicitly reported absence rather than suppressing a sourced fact',()=>{const original='OpenAI 尚未回应。';expect(projectDigest(original,articles,['OpenAI did not respond to a request for comment.'])).toEqual({digest:original,fallback:false});});
});
