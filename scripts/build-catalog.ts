import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {getModel} from '../lib/engine';
import {getTmdbMovie,tmdbGet} from '../lib/tmdb';

type Entry={imdbId:string;tmdbId:string;title:string;year:string;genres:string[];overview:string;director:string[];cast:string[];keywords:string[];source:string};
const normalize=(x:string)=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^(the|a|an) /,'').replace(/, (the|a|an)$/,'').replace(/[^a-z0-9]/g,'');
async function main(){
 const model=getModel(),text=readFileSync('imdb_top_1000.csv','utf8'),rows:Record<string,string>[]=parse(text,{columns:true,bom:true});
 const lookup=new Map<string,Set<number>>();
 model.movies.forEach((m,i)=>{const year=m.title.match(/\((\d{4})\)$/)?.[1];const title=m.title.replace(/\s*\(\d{4}\)$/,'');const aliases=[title,title.replace(/\s*\([^)]*\)/g,''),...Array.from(title.matchAll(/\(([^)]*)\)/g),x=>x[1].replace(/^a\.k\.a\. /,''))];for(const alias of aliases){const key=normalize(alias)+'|'+year;if(!lookup.has(key))lookup.set(key,new Set());lookup.get(key)!.add(i)}});
 const entries=new Map<string,Entry>();let ambiguous=0,unmatched=0;
 for(const r of rows){const candidates=lookup.get(normalize(r.Series_Title)+'|'+r.Released_Year);if(!candidates||candidates.size!==1){if(candidates?.size)ambiguous++;else unmatched++;continue}const movie=model.movies[[...candidates][0]];entries.set(movie.imdbId,{imdbId:movie.imdbId,tmdbId:movie.tmdbId,title:r.Series_Title,year:r.Released_Year,genres:r.Genre.split(',').map(x=>x.trim()),overview:r.Overview,director:[r.Director],cast:[r.Star1,r.Star2,r.Star3,r.Star4].filter(Boolean),keywords:[],source:'user-imdb-top-1000'});}
 const localMatched=entries.size,ids=new Set<number>();const asOf=new Date().toISOString().slice(0,10),yearNow=Number(asOf.slice(0,4));
 for(let year=2019;year<=yearNow;year++){
  const data=await tmdbGet<{results:{id:number}[]}>('/discover/movie',{primary_release_year:String(year),'primary_release_date.lte':asOf,sort_by:'vote_count.desc','vote_count.gte':'20',include_adult:'false',include_video:'false',language:'en-US',page:'1'});
  for(const film of data.results)ids.add(film.id);
 }
 mkdirSync('data/raw/tmdb',{recursive:true});let errors=0;
 const selected=[...ids];
 for(let start=0;start<selected.length;start+=4){
  const result=await Promise.allSettled(selected.slice(start,start+4).map(async id=>{
   const file=`data/raw/tmdb/${id}.json`;const movie=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):await getTmdbMovie(id,'en-US');
   if(!existsSync(file))writeFileSync(file,JSON.stringify(movie));
   if(!/^tt\d+$/.test(movie.imdb_id||'')||!movie.release_date||movie.release_date>asOf)return;
   entries.set(movie.imdb_id,{imdbId:movie.imdb_id,tmdbId:String(id),title:movie.title,year:movie.release_date.slice(0,4),genres:movie.genres.map((g:{name:string})=>g.name),overview:movie.overview,director:movie.credits.crew.filter((x:{job:string})=>x.job==='Director').map((x:{name:string})=>x.name),cast:movie.credits.cast.slice(0,4).map((x:{name:string})=>x.name),keywords:movie.keywords.keywords.map((x:{name:string})=>x.name),source:'tmdb'} satisfies Entry);
  }));errors+=result.filter(x=>x.status==='rejected').length;
  if(start%40===0)console.log(`TMDB details ${Math.min(start+4,selected.length)}/${selected.length}`);
 }
 const report={asOf,localRows:rows.length,localMatched,ambiguous,unmatched,tmdbRequested:ids.size,tmdbLoaded:[...entries.values()].filter(x=>x.source==='tmdb').length,errors,sourceSha256:createHash('sha256').update(text).digest('hex'),note:'Top 20 most-voted released movies per year since 2019. A bounded catalog expansion, not all TMDB titles. Ratings/vote averages are not training labels.'};
 writeFileSync('data/catalog-extra.json',JSON.stringify({report,entries:[...entries.values()]}));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Catalog failed');process.exitCode=1});
