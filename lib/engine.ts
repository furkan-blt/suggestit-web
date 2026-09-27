import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export type Rating={imdbId?:string;tmdbId?:string;title?:string;year?:string;rating:number|null};
export type Movie={id:number;title:string;genres:string[];imdbId:string;tmdbId:string};
export type Model={version:number;movies:Movie[];genreNames:string[];content:number[][];features?:[number,number][][];featureCount?:number;enriched?:boolean[];cfAvailable?:boolean[];factors:number[][];users:[number,number][][];eligible:boolean[];weights:number[];demo:[number,number][]};
let cached:Model|undefined;
export function getModel():Model{return cached??=JSON.parse(readFileSync(join(process.cwd(),'data/model.json'),'utf8'));}
const dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*b[i],0);
export function percentile(values:number[]):number[]{
 const order=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v||a.i-b.i); const ranks=Array(values.length).fill(0);
 for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].v===order[i].v)j++;const rank=(i+j-1)/2/Math.max(order.length-1,1);for(let k=i;k<j;k++)ranks[order[k].i]=rank;i=j;}return ranks;
}
function titleKey(title:string){return title.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
export function matchHistory(ratings:Rating[],model=getModel()):[number,number][] {
 const imdb=new Map(model.movies.map((m,i)=>[m.imdbId,i])); const tmdb=new Map(model.movies.filter(m=>m.tmdbId).map(m=>[m.tmdbId,model.movies.indexOf(m)]));
 const titles=new Map<string,number[]>();model.movies.forEach((m,i)=>{const k=titleKey(m.title);titles.set(k,[...(titles.get(k)||[]),i])});
 const matched=new Map<number,number>();
 for(const r of ratings){let i=r.imdbId?imdb.get(r.imdbId):r.tmdbId?tmdb.get(String(r.tmdbId)):undefined;
  if(i===undefined&&r.title&&r.year){const found=titles.get(titleKey(`${r.title} (${r.year})`));if(found?.length===1)i=found[0]}
  // RSS newest entries come first. Rewatches must not multiply a film's influence.
  if(i!==undefined&&!matched.has(i))matched.set(i,r.rating===null?3:Math.max(.5,Math.min(5,r.rating)));
 }return [...matched];
}
export function recommend(history:[number,number][],model=getModel(),limit=12,explicitLikes?:Set<number>){
 const n=model.movies.length, k=model.factors[0].length,g=model.genreNames.length;
 const h=Array(n).fill(0),seen=new Set<number>();for(const [i,r]of history){if(!Number.isInteger(i)||i<0||i>=n||!Number.isFinite(r))throw new Error('Invalid history');h[i]=Math.max(r-2.5,0);seen.add(i)}
 const sum=h.reduce((a,b)=>a+b,0);if(!sum)throw new Error('NO_POSITIVE_HISTORY');
 const user=Array(k).fill(0),taste=Array(model.featureCount||g).fill(0);for(const [i]of history){for(let j=0;j<k;j++)user[j]+=h[i]*model.factors[i][j];if(model.features){for(const[j,v]of model.features[i])taste[j]+=h[i]*v}else for(let j=0;j<g;j++)taste[j]+=h[i]*model.content[i][j]}
 const norm=Math.sqrt(dot(taste,taste));if(norm)for(let j=0;j<taste.length;j++)taste[j]/=norm;
 const seed=h.map(x=>x/sum),degree=Array(n).fill(0); const userDegrees=model.users.map(edges=>edges.reduce((s,[i,w])=>{degree[i]+=w;return s+w},0));
 let p=[...seed];for(let step=0;step<30;step++){const walked=Array(n).fill(0);model.users.forEach((edges,u)=>{let mass=0;for(const [i,w]of edges)if(degree[i])mass+=p[i]*w/degree[i];if(userDegrees[u])for(const[i,w]of edges)walked[i]+=mass*w/userDegrees[u]});const missing=Math.max(0,1-walked.reduce((a,b)=>a+b,0));const next=walked.map((v,i)=>.15*seed[i]+.85*(v+missing*seed[i]));const delta=next.reduce((s,v,i)=>s+Math.abs(v-p[i]),0);p=next;if(delta<1e-8)break;}
 const candidates=model.movies.map((_,i)=>i).filter(i=>model.eligible[i]&&!seen.has(i));
 const hasCollaborativeHistory=history.some(([i])=>h[i]>0&&(!model.cfAvailable||model.cfAvailable[i]));
 const signals=[percentile(candidates.map(i=>dot(model.factors[i],user))),percentile(candidates.map(i=>model.features?model.features[i].reduce((s,[f,v])=>s+v*taste[f],0):dot(model.content[i],taste))),percentile(candidates.map(i=>p[i]))];
 return candidates.map((i,j)=>{const m=model.movies[i];const cold=!hasCollaborativeHistory||(model.cfAvailable&&!model.cfAvailable[i]);const weights=cold?[0,1,0]:model.weights;const parts=signals.map((s,c)=>s[j]*weights[c]);const strongest=parts.indexOf(Math.max(...parts));
 let reason=['Benzer puanlama alışkanlıkları olan izleyicilerin beğenileriyle örtüşüyor.','Beğendiğin filmlerin türleriyle benzerlik taşıyor.','Beğendiğin filmlerle ortak izleyici bağlantıları taşıyor.'][strongest];
 if(strongest===1){reason=model.enriched?.[i]?'Tür, konu, yönetmen ve oyuncu özelliklerinin birleşimi tercih profilinle benzeşiyor.':'Beğendiğin filmlerin türleriyle benzerlik taşıyor.';if(cold)reason+=' Bu film için ortak puan verisi olmadığından içerik benzerliği kullanıldı.';}
 return {id:m.id,title:m.title.replace(/\s*\(\d{4}\)$/,''),year:m.title.match(/\((\d{4})\)$/)?.[1]||'',genres:m.genres,imdbId:m.imdbId,score:parts.reduce((a,b)=>a+b,0),reason,index:i};
 }).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit).map(({index,...m})=>{
  // Explanations are computed after ranking, so evidence never changes the score.
  // An unrated Letterboxd watch can seed discovery, but must not be called a like.
  const recommendedGenres=new Set(model.movies[index].genres);
  const related=history.map(([seed,rating])=>{
   if(rating<=2.5||(explicitLikes&&!explicitLikes.has(seed)))return null;
   const common=model.movies[seed].genres.filter(genre=>recommendedGenres.has(genre));
   if(!common.length)return null;
   const union=new Set([...model.movies[seed].genres,...recommendedGenres]).size;
   return {seed,common,closeness:common.length/union*(rating-2.5)};
  }).filter((value):value is {seed:number;common:string[];closeness:number}=>value!==null)
   .sort((a,b)=>b.closeness-a.closeness||a.seed-b.seed)[0];
  if(!related)return explicitLikes?.size===0?{...m,reason:m.reason.replaceAll('Beğendiğin filmlerin','İzlediğin filmlerin').replaceAll('Beğendiğin filmlerle','İzlediğin filmlerle')}:m;
  const likedTitle=model.movies[related.seed].title.replace(/\s*\(\d{4}\)$/,'');
  return {...m,reason:`“${m.title}” filmini önerdik çünkü “${likedTitle}” filmini beğendin. Ortak tür: ${related.common.slice(0,2).join(' ve ')}.`};
 });
}
