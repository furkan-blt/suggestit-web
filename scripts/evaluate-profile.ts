import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {parseImdbCsv,normalizeRatingDate} from '../lib/imdb-csv';
import {gradedMetrics} from '../lib/evaluation';
import {getModel,matchHistory,recommend} from '../lib/engine';
import {findTmdbMovie,tmdbConfigured} from '../lib/tmdb';

async function main(){
 const files=readdirSync('.').filter(x=>x.toLowerCase().endsWith('.csv'));
 const file=process.argv[2]||(files.length===1?files[0]:undefined);
 if(!file)throw new Error('Specify exactly one CSV path.');
 const csv=readFileSync(file,'utf8'),raw:Record<string,string>[]=parse(csv,{columns:true,bom:true,skip_empty_lines:true});
 const profile=parseImdbCsv(csv),model=getModel(),matched=matchHistory(profile.ratings,model);
 const dates=new Map<string,string>();for(const row of raw){const id=row.Const||row.const;const date=normalizeRatingDate(row['Date Rated']||row.created||'');const old=dates.get(id)||'';if(date>old)dates.set(id,date);}
 const movies=profile.ratings.map(r=>({...r,date:dates.get(r.imdbId!)||''})).sort((a,b)=>a.date.localeCompare(b.date)||a.imdbId!.localeCompare(b.imdbId!));
 if(movies.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.date)))throw new Error('Missing rating dates; temporal split cannot be performed.');
 // Fixed split fractions, threshold, objective, and grid BEFORE inspecting test outcomes.
 const validationStart=movies[Math.floor(movies.length*.6)].date,testStart=movies[Math.floor(movies.length*.8)].date;
 const train=movies.filter(r=>r.date<validationStart),validation=movies.filter(r=>r.date>=validationStart&&r.date<testStart),test=movies.filter(r=>r.date>=testStart);
 if(!train.length||!validation.length||!test.length)throw new Error('Date groups do not support three non-empty partitions.');
 const indexByImdb=new Map(model.movies.map((m,i)=>[m.imdbId,i]));
 const popularity=Array(model.movies.length).fill(0);for(const edges of model.users)for(const [i,w]of edges)popularity[i]+=w;
 function stage(history:typeof movies,future:typeof movies){
  const h=matchHistory(history,model);
  // Warm catalog only for component weight comparison. Expanded cold-start routing is tested separately.
  const availableBefore=future[0].date;
  const eligible=model.movies.map((m,i)=>Boolean((model.cfAvailable?.[i]??model.eligible[i])&&Number(m.title.match(/\((\d{4})\)$/)?.[1]||0)<=Number(availableBefore.slice(0,4))));
  const rankings=[[1,0,0],[0,1,0],[0,0,1]].map(weights=>recommend(h,{...model,eligible,weights},model.movies.length));
  const signals=rankings.map(list=>new Map(list.map(m=>[m.id,m.score])));
  const candidates=rankings[0].map(m=>({id:m.id,imdb:m.imdbId,index:indexByImdb.get(m.imdbId)!,scores:signals.map(s=>s.get(m.id)!)}));
  const positive=new Set(future.filter(r=>r.rating!==null&&r.rating>=3).map(r=>r.imdbId));
  const relevant=new Set(candidates.filter(c=>positive.has(c.imdb)).map(c=>c.id));
  if(!relevant.size)throw new Error('No eligible positive targets.');
  const heldOut=new Map(future.filter(r=>r.rating!==null).map(r=>[r.imdbId!,r.rating!*2]));
  const eligibleIds=new Set(candidates.map(c=>c.imdb));
  const metrics=(ranking:typeof candidates)=>({...gradedMetrics(ranking.map(c=>c.imdb),heldOut,eligibleIds),top:ranking.slice(0,10).map(c=>model.movies[c.index].title)});
  const evaluate=(weights:number[])=>metrics([...candidates].sort((a,b)=>b.scores.reduce((s,v,i)=>s+v*weights[i],0)-a.scores.reduce((s,v,i)=>s+v*weights[i],0)||a.index-b.index));
  return {evaluate,popularity:()=>metrics([...candidates].sort((a,b)=>popularity[b.index]-popularity[a.index]||a.index-b.index)),info:{history:history.length,matchedHistory:h.length,future:future.length,positiveTargets:positive.size,eligibleTargets:relevant.size,candidates:candidates.length}};
 }
 const v=stage(train,validation),experiments=[];
 for(let a=0;a<=20;a++)for(let b=0;b<=20-a;b++){const weights=[a/20,b/20,(20-a-b)/20];experiments.push({weights,...v.evaluate(weights)});}
 // Exact ties prefer the already deployed weights, then preserve grid order.
 experiments.sort((a,b)=>b.ndcg10-a.ndcg10||a.weights.reduce((s,w,i)=>s+Math.abs(w-model.weights[i]),0)-b.weights.reduce((s,w,i)=>s+Math.abs(w-model.weights[i]),0));
 const selected=experiments[0].weights;
 const t=stage([...train,...validation],test);
 const testMetrics={selected:t.evaluate(selected),deployed:t.evaluate(model.weights),mf:t.evaluate([1,0,0]),cosine:t.evaluate([0,1,0]),ppr:t.evaluate([0,0,1]),positiveWeightedPopularity:t.popularity()};
 const unmatched=movies.filter(r=>!indexByImdb.has(r.imdbId!));
 const tmdbSample=[];
 if(tmdbConfigured())for(const item of unmatched.slice(-10)){
  try{const found=await findTmdbMovie(item.imdbId!);tmdbSample.push({imdbId:item.imdbId,status:found.movie_results.length===1?'matched':found.movie_results.length?'ambiguous':'not_found',matches:found.movie_results});}
  catch(e){tmdbSample.push({imdbId:item.imdbId,status:'error',error:e instanceof Error?e.message:'Request failed'});}
 }
 // Ratings are never sent to TMDB, only external public movie IDs.
 const report={source:file,sha256:createHash('sha256').update(csv).digest('hex'),rows:raw.length,films:movies.length,excluded:raw.length-movies.length,matched:matched.length,unmatched:unmatched.length,coverage:matched.length/movies.length,ratingAverage10:movies.reduce((s,r)=>s+r.rating!*2,0)/movies.length,validationStart,testStart,validation:v.info,test:t.info,gridSize:experiments.length,selectedWeights:selected,deployedWeights:model.weights,validationBest:experiments[0],testMetrics,tmdbSample,allHistoryRecommendations:recommend(matched,model),limitations:['Single-user diagnostic; not a generalization or optimality claim.','Date Rated can be bulk import date, not watch date; identical dates kept in same partition.','Fixed collaborative model trained on 2018 MovieLens; held-out personal ratings not folded into user profile.','Only >=8/10 held-out ratings are relevant; unknown candidate relevance is not treated as verified dislike.','Warm-item catalog restricts eligible recall; recall across all positive targets also reported.','No production weight change based on this single profile.','TMDB lookup sample is a coverage check, not a recommendation benchmark.'],experiments:experiments.map(({weights,ndcg10,precision10})=>({weights,ndcg10,precision10}))};
 mkdirSync('data/private',{recursive:true});const slug=file.replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();writeFileSync(`data/private/profile-evaluation-${slug}.json`,JSON.stringify(report,null,2));
 const lines=['# Kişisel CSV değerlendirmesi','',`Kaynak: ${file}`,`SHA-256: ${report.sha256}`,'',`Toplam ${report.rows} kayıt; ${report.films} film; ${report.excluded} film dışı kayıt.`,`${report.matched} film katalogda eşleşti (%${(report.coverage*100).toFixed(1)}); ${report.unmatched} film eşleşmedi.`,'',`Puan ortalaması: ${report.ratingAverage10.toFixed(2)}/10.`,`Doğrulama başlangıcı: ${validationStart}; test başlangıcı: ${testStart}. Aynı gün kayıtları bölünmedi.`,`Geçmiş / doğrulama / test: ${train.length} / ${validation.length} / ${test.length} film.`,`231 karışım arasından doğrulamada seçilen MF/Cosine/PPR: ${selected.join(' / ')}. Üretim ağırlıkları değiştirilmedi.`,'','| Yöntem | Test NDCG@10 | İlk 10 isabet | Uygun hedeflerde Recall@10 | Tüm olumlu hedeflerde Recall@10 |','|---|---:|---:|---:|---:|',...Object.entries(testMetrics).map(([name,m])=>`| ${name} | ${m.ndcg10.toFixed(4)} | ${m.hits} | %${(m.recall10Eligible*100).toFixed(1)} | %${(m.recall10AllPositives*100).toFixed(1)} |`),'',`Testte ${t.info.positiveTargets} olumlu hedeften ${t.info.eligibleTargets} tanesi öneri adayları arasındaydı.`,`TMDB: son 10 eşleşmeyen film örneğinden ${tmdbSample.filter(x=>x.status==='matched').length}/${tmdbSample.length} eşleşti.`,'','## Sınırlar',...report.limitations.map(x=>'- '+x),'','Bu rapor ve kaynak CSV Git ve dağıtım kapsamı dışındadır.'];
 writeFileSync(`data/private/profile-evaluation-${slug}.md`,lines.join('\n'));
 console.log(JSON.stringify({...report,experiments:undefined,allHistoryRecommendations:report.allHistoryRecommendations.slice(0,3),tmdbSample:{tested:tmdbSample.length,matched:tmdbSample.filter(x=>x.status==='matched').length}},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Evaluation failed');process.exitCode=1});
