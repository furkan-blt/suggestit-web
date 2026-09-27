import {NextRequest,NextResponse} from 'next/server';
import {getModel,matchHistory,recommend} from '@/lib/engine';
import {buildTasteGraph} from '@/lib/graph';
import {boundedText,getProfile,ProviderError} from '@/lib/providers';
import {parseImdbCsv} from '@/lib/imdb-csv';
import type {Rating} from '@/lib/engine';
export const runtime='nodejs';
export const maxDuration=30;
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function unmatchedHistory(ratings:Rating[],history:[number,number][],model:ReturnType<typeof getModel>):Rating[]{
 const ids=new Set(history.map(([index])=>model.movies[index].imdbId));
 const tmdb=new Set(history.map(([index])=>model.movies[index].tmdbId));
 const title=new Set(history.map(([index])=>model.movies[index].title.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim()));
 const seen=new Set<string>();
 return ratings.filter(rating=>{
  const titleKey=rating.title&&rating.year?`${rating.title} (${rating.year})`.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
  if(rating.imdbId&&ids.has(rating.imdbId)||rating.tmdbId&&tmdb.has(String(rating.tmdbId))||titleKey&&title.has(titleKey))return false;
  const key=rating.imdbId||rating.tmdbId||titleKey;if(!key||seen.has(key))return false;seen.add(key);return true;
 });
}
export async function POST(req:NextRequest){
 try{
  const isCsv=req.headers.get('content-type')?.startsWith('text/csv');
  if(!isCsv&&!req.headers.get('content-type')?.startsWith('application/json'))return response({error:'JSON veya CSV isteği gerekli.'},415);
  let body;let imported;
  if(isCsv){imported=parseImdbCsv(await boundedText(new Response(req.body),2_000_000));body={platform:'imdb-csv',nickname:''};}
  else {try{body=JSON.parse(await boundedText(new Response(req.body),2048))}catch(e){if(e instanceof ProviderError)throw e;return response({error:'İstek biçimi geçersiz.'},400)}
  if(!body||!['letterboxd','imdb','demo'].includes(body.platform)||typeof body.nickname!=='string')return response({error:'Platform ve kullanıcı adı gerekli.'},400);}
  const model=getModel();
  const demo=body.platform==='demo';
  const profile=imported??(demo?{name:'MovieLens 414 (anonim örnek)',source:'demo',ratings:[],warnings:['Bu sonuçlar örnek bir MovieLens profiline aittir; senin hesabından alınmamıştır.']}:await getProfile(body.platform,body.nickname));
  const history=demo?model.demo:matchHistory(profile.ratings,model);
  const explicitRatings=demo?new Set(history.map(([index])=>index)):new Set(matchHistory(profile.ratings.filter(rating=>rating.rating!==null),model).map(([index])=>index));
  const explicitLikes=new Set(history.filter(([index,rating])=>explicitRatings.has(index)&&rating>2.5).map(([index])=>index));
  if(!history.length)return response({error:'Profil okundu, ancak filmlerin araştırma kataloğuyla eşleşmedi. Güncel katalog TMDB ve MovieLens verilerinden oluşturuluyor.'},422);
  if(!history.some(([,r])=>r>2.5))return response({error:'Eşleşen filmlerde olumlu tercih sinyali bulunamadı. Kişisel öneri için daha fazla puanlama gerekli.'},422);
  return response({profile:profile.name,source:profile.source,matched:history.length,total:demo?history.length:profile.ratings.length,warnings:[...profile.warnings,'İşbirlikçi eğitim verisi 2018’de sona eriyor. 2019 sonrası filmler TMDB içerik özellikleriyle soğuk başlangıç olarak sıralanır.',...(history.length<5?['Az sayıda film eşleştiği için öneriler daha az güvenilir olabilir.']:[])],graph:buildTasteGraph(history,model,explicitRatings,demo?[]:unmatchedHistory(profile.ratings,history,model)),recommendations:recommend(history,model,12,explicitLikes),weights:model.weights});
 }catch(e){if(e instanceof ProviderError)return response({error:e.message},e.status);if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError'))return response({error:'Profil servisi zamanında yanıt vermedi. Tekrar deneyebilirsin.'},504);return response({error:'Öneriler şu anda hazırlanamadı. Lütfen tekrar dene.'},503)}
}
