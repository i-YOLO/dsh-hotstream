/** Keep the public proxy limited to the requested anonymous Terminal-Bench repository reads. */
import {anonymousPublicRead,type GuardedFetchOptions,type PublicNetwork} from '../network.ts';

type Transport=Pick<PublicNetwork,'fetch'>;
export function leaderboardTransport(input:string,options:GuardedFetchOptions|undefined,direct:Transport,arena:Transport|null,publicReads:Transport):Transport{
 const url=new URL(input);
 if(arena&&url.hostname==='huggingface.co')return arena;
 const terminalRepository=url.protocol==='https:'&&!url.port&&(
  url.hostname==='api.github.com'&&url.pathname.startsWith('/repos/harbor-framework/terminal-bench/')||
  url.hostname==='raw.githubusercontent.com'&&url.pathname.startsWith('/harbor-framework/terminal-bench/')
 );
 return terminalRepository&&anonymousPublicRead(input,options)?publicReads:direct;
}
