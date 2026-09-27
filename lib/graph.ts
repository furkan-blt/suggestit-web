import type {Model,Rating} from './engine';
import metadataFile from '../data/graph-meta.json';

type Metadata={director:string[];cast:string[];keywords:string[]};
const metadata=metadataFile as Record<string,Metadata>;
export type GraphNode={id:number;label:string;year:string;rating?:number;group:string;genres:string[];director:string[];cast:string[];keywords:string[]};
export type GraphEdge={source:number;target:number;strength:number;patterns:string[]};
export type TasteGraph={nodes:GraphNode[];edges:GraphEdge[];reveal:number[];groups:{name:string;count:number}[];watched:number};
type Kind='genre'|'director'|'actor'|'keyword';
const prefix:Record<Kind,string>={genre:'Tür',director:'Yönetmen',actor:'Oyuncu',keyword:'Anahtar kelime'};
const clean=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('en').trim();
const label=(title:string)=>title.replace(/\s*\(\d{4}\)$/,'');

export function buildTasteGraph(history:[number,number][],model:Model,explicitRatings:Set<number>,unmatched:Rating[]=[]):TasteGraph{
 const genreCounts=new Map<string,number>();
 for(const [index] of history)for(const genre of model.movies[index].genres)genreCounts.set(genre,(genreCounts.get(genre)??0)+1);
 const nodes=history.map(([index,rating]):GraphNode=>{
  const movie=model.movies[index],meta=metadata[movie.imdbId];
  const genres=movie.genres.filter(genre=>genre!=='(no genres listed)');
  const group=[...genres].sort((a,b)=>(genreCounts.get(a)??0)-(genreCounts.get(b)??0)||a.localeCompare(b))[0]??'Diğer';
  return {id:index,label:label(movie.title),year:movie.title.match(/\((\d{4})\)$/)?.[1]??'',rating:explicitRatings.has(index)?rating:undefined,group,genres,director:meta?.director??[],cast:meta?.cast??[],keywords:meta?.keywords??[]};
 });
 unmatched.forEach((movie,index)=>nodes.push({id:-index-1,label:movie.title?.trim()||movie.imdbId||movie.tmdbId||'Bilinmeyen film',year:movie.year??'',rating:movie.rating??undefined,group:'Metadata yok',genres:[],director:[],cast:[],keywords:[]}));
 const buckets=new Map<string,number[]>();
 const tags=nodes.map(node=>{
  const items:[Kind,string][]=[...node.genres.map(value=>['genre',value] as [Kind,string]),...node.director.map(value=>['director',value] as [Kind,string]),...node.cast.map(value=>['actor',value] as [Kind,string]),...node.keywords.map(value=>['keyword',value] as [Kind,string])];
  return new Set(items.map(([kind,value])=>`${kind}:${clean(value)}`));
 });
 tags.forEach((items,i)=>{for(const key of items){const bucket=buckets.get(key)??[];bucket.push(i);buckets.set(key,bucket);}});
 const candidateKeys=new Set<string>();
 for(const bucket of buckets.values()){
  bucket.sort((a,b)=>((nodes[a].rating??3)-(nodes[b].rating??3))||(Number(nodes[a].year)-Number(nodes[b].year))||a-b);
  for(let a=0;a<bucket.length;a++){
   const end=bucket.length<=32?bucket.length:Math.min(bucket.length,a+7);
   for(let b=a+1;b<end;b++){
    const i=bucket[a],j=bucket[b];candidateKeys.add(`${Math.min(i,j)}:${Math.max(i,j)}`);
   }
  }
 }
 const candidates:{a:number;b:number;edge:GraphEdge}[]=[];
 const weight=(kind:Kind)=>kind==='director'?.38:kind==='actor'?.26:kind==='keyword'?.2:.16;
 for(const key of candidateKeys){const [a,b]=key.split(':').map(Number);const left=nodes[a],right=nodes[b];
  const shared=[...tags[a]].filter(tag=>tags[b].has(tag));if(!shared.length)continue;
  const score=shared.reduce((sum,tag)=>{const kind=tag.split(':',1)[0] as Kind;return sum+weight(kind)/Math.sqrt(Math.max(1,buckets.get(tag)!.length-1));},0);
  const ratingA=nodes[a].rating??3,ratingB=nodes[b].rating??3;
  const affinity=.75+.25*(1-Math.abs(ratingA-ratingB)/4.5);
  const patterns=shared.sort((x,y)=>weight(y.split(':',1)[0] as Kind)-weight(x.split(':',1)[0] as Kind)).slice(0,3).map(tag=>{const colon=tag.indexOf(':');const kind=tag.slice(0,colon) as Kind;const original=[...left.genres,...left.director,...left.cast,...left.keywords].find(value=>clean(value)===tag.slice(colon+1))??tag.slice(colon+1);return `${prefix[kind]}: ${original}`;});
  candidates.push({a,b,edge:{source:left.id,target:right.id,strength:Math.min(1,score*affinity),patterns}});
 }
 const incident=new Map<number,{a:number;b:number;edge:GraphEdge}[]>();
 for(const candidate of candidates){for(const index of [candidate.a,candidate.b]){const list=incident.get(index)??[];list.push(candidate);incident.set(index,list);}}
 const chosen=new Set<string>();
 for(const list of incident.values()){list.sort((a,b)=>b.edge.strength-a.edge.strength||a.a-b.a||a.b-b.b);for(const edge of list.slice(0,3))chosen.add(`${edge.a}:${edge.b}`);}
 const edges=candidates.filter(candidate=>chosen.has(`${candidate.a}:${candidate.b}`)).map(candidate=>candidate.edge).sort((a,b)=>b.strength-a.strength||a.source-b.source||a.target-b.target);
 const seen=new Set<number>(),reveal:number[]=[];
 for(const edge of edges)for(const id of [edge.source,edge.target])if(!seen.has(id)){seen.add(id);reveal.push(id);}
 for(const node of nodes)if(!seen.has(node.id))reveal.push(node.id);
 const groupCounts=new Map<string,number>();for(const node of nodes)groupCounts.set(node.group,(groupCounts.get(node.group)??0)+1);
 const groups=[...groupCounts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 return {nodes,edges,reveal,groups,watched:nodes.length};
}
