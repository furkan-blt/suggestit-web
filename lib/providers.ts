import {XMLParser,XMLValidator} from 'fast-xml-parser';
import type {Rating} from './engine';
export class ProviderError extends Error {constructor(message:string,public status=422){super(message)}}
export type Profile={name:string;source:string;ratings:Rating[];warnings:string[]};
export function normalizeIdentifier(platform:string,input:string){
 const value=input.trim();if(!value||value.length>200)throw new ProviderError('Geçerli bir kullanıcı adı gir.');
 if(platform==='letterboxd'){
  let name=value;
  if(/^https?:\/\//i.test(value)){let url:URL;try{url=new URL(value)}catch{throw new ProviderError('Geçersiz profil bağlantısı.')}if(url.hostname!=='letterboxd.com'&&url.hostname!=='www.letterboxd.com')throw new ProviderError('Letterboxd profil bağlantısını kullan.');name=url.pathname.split('/').filter(Boolean)[0]||'';}
  if(!/^[a-zA-Z0-9_]{1,40}$/.test(name))throw new ProviderError('Letterboxd kullanıcı adını veya profil bağlantısını gir.');return name.toLowerCase();
 }
 if(platform==='imdb'){
  if(/^https?:\/\//i.test(value)){let u:URL;try{u=new URL(value)}catch{throw new ProviderError('Geçersiz profil bağlantısı.')}if(!['imdb.com','www.imdb.com'].includes(u.hostname))throw new ProviderError('IMDb profil bağlantısını kullan.');const id=u.pathname.match(/^\/user\/((?:ur\d+|p\.[a-zA-Z0-9_-]+))\/?$/)?.[1];if(!id)throw new ProviderError('IMDb profil bağlantısı /user/ur…/ veya /user/p.…/ biçiminde olmalı.');return id;}
  if(!/^[\p{L}\p{N}_ .-]{1,80}$/u.test(value))throw new ProviderError('Geçerli bir IMDb kullanıcı adı gir.');return value;
 }throw new ProviderError('Desteklenmeyen platform.');
}
export function parseLetterboxd(xml:string,name:string):Profile{
 if(XMLValidator.validate(xml)!==true)throw new ProviderError('Letterboxd geçerli bir RSS akışı döndürmedi.',502);
 const parsed=new XMLParser({ignoreAttributes:false,parseTagValue:false}).parse(xml);
 if(!parsed.rss?.channel)throw new ProviderError('Letterboxd RSS akışına erişilemedi.',502);
 const raw=parsed.rss.channel.item;const items=raw?Array.isArray(raw)?raw:[raw]:[];
 const ratings:Rating[]=items.filter((x:Record<string,string>)=>x['letterboxd:filmTitle']).map((x:Record<string,string>)=>({title:String(x['letterboxd:filmTitle']),year:String(x['letterboxd:filmYear']||''),tmdbId:x['tmdb:movieId']?String(x['tmdb:movieId']):undefined,rating:x['letterboxd:memberRating']&&Number.isFinite(Number(x['letterboxd:memberRating']))?Number(x['letterboxd:memberRating']):null}));
 if(!ratings.length)throw new ProviderError('Bu profilin RSS akışında film bulunamadı. Geçmiş boş veya erişime kapalı olabilir.');
 return {name,source:'letterboxd-rss',ratings,warnings:['Letterboxd RSS yalnızca son etkinlikleri kapsar. Eski izlemelerin tamamına erişilmediği için daha önce izlediğin filmler önerilebilir.']};
}
export async function boundedText(response:Response,limit=2_000_000):Promise<string>{
 const reader=response.body?.getReader();if(!reader)return '';const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new ProviderError('Veri boyutu sınırı aşıldı.',413)}chunks.push(value)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks).toString('utf8');
}
const cache=new Map<string,{expires:number;profile:Profile}>();
export async function getProfile(platform:string,input:string):Promise<Profile>{
 const identifier=normalizeIdentifier(platform,input);const key=`${platform}:${identifier}`;const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.profile;
 let profile:Profile;
 if(process.env.PROFILE_ADAPTER_URL){
  // Only a server-configured URL is used; user input never chooses a fetch host.
  const u=new URL(process.env.PROFILE_ADAPTER_URL);if(u.protocol!=='https:')throw new ProviderError('Profil sağlayıcısı güvenli bağlantı ile yapılandırılmalı.',503);
  u.searchParams.set('platform',platform);u.searchParams.set('identifier',identifier);
  const response=await fetch(u,{headers:{Authorization:`Bearer ${process.env.PROFILE_ADAPTER_TOKEN||''}`},signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
  if(!response.ok)throw new ProviderError('Profil sağlayıcısı hesabı okuyamadı. Profilin herkese açık olduğunu kontrol et.',502);
  const data=JSON.parse(await boundedText(response));
  if(typeof data.name!=='string'||!Array.isArray(data.ratings)||data.ratings.length>20000||!data.ratings.every((r:Rating)=>(r.rating===null||(typeof r.rating==='number'&&Number.isFinite(r.rating)&&r.rating>=.5&&r.rating<=5))&&(typeof r.imdbId==='string'||typeof r.tmdbId==='string')))throw new ProviderError('Profil sağlayıcısının veri biçimi geçersiz.',502);
  profile={name:data.name,source:platform,ratings:data.ratings,warnings:data.complete===true?[]:['Sağlayıcı geçmişin tamamının alındığını doğrulamadı.']};
 }else if(platform==='letterboxd'){
  const response=await fetch(`https://letterboxd.com/${encodeURIComponent(identifier)}/rss/`,{headers:{'User-Agent':'FilmAtlasi/0.1','Accept':'application/rss+xml, application/xml'},signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
  if(response.status===404)throw new ProviderError('Letterboxd profili bulunamadı.',404);
  if(!response.ok)throw new ProviderError('Letterboxd şu anda profil verisine erişime izin vermiyor. Daha sonra tekrar dene.',502);
  profile=parseLetterboxd(await boundedText(response),identifier);
 }else{
  throw new ProviderError('IMDb bağlantısı henüz etkin değil. Kullanıcı adını puanlama geçmişine dönüştüren bir veri sağlayıcısı gerekiyor; profil bağlantısı tek başına bu erişimi sağlamaz. Şimdilik Letterboxd veya örnek profili kullanabilirsin.',503);
 }
 if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{profile,expires:Date.now()+300000});return profile;
}
