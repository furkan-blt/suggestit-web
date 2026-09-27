/** Server-only credentials. Never import this module from a client component. */
export function tmdbConfigured(){return Boolean(process.env.TMDB_READ_ACCESS_TOKEN?.trim()||process.env.TMDB_API_KEY?.trim());}
export async function tmdbGet<T>(path:string,params:Record<string,string>={}):Promise<T>{
 const token=process.env.TMDB_READ_ACCESS_TOKEN?.trim(),key=process.env.TMDB_API_KEY?.trim();
 if(!token&&!key)throw new Error('TMDB anahtarı eksik. .env.local dosyasında TMDB_READ_ACCESS_TOKEN veya TMDB_API_KEY alanını doldur.');
 if(!/^\/[a-zA-Z0-9/_-]+$/.test(path))throw new Error('Geçersiz TMDB endpoint.');
 const url=new URL(`https://api.themoviedb.org/3${path}`);url.searchParams.set('language','tr-TR');
 for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);
 const headers:Record<string,string>={accept:'application/json'};
 if(token)headers.Authorization=`Bearer ${token}`;else url.searchParams.set('api_key',key!);
 let res:Response;
 try{res=await fetch(url,{headers,signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});}
 catch{throw new Error('TMDB bağlantısı kurulamadı veya süre aşıldı.');}
 if(res.status===401||res.status===403)throw new Error('TMDB anahtarı kabul edilmedi. Anahtar türünü ve değerini kontrol et.');
 if(res.status===429)throw new Error('TMDB istek sınırına ulaşıldı; daha sonra tekrar dene.');
 if(!res.ok)throw new Error(`TMDB isteği başarısız (HTTP ${res.status}).`);
 return res.json() as Promise<T>;
}
export type TmdbMovie={id:number;imdb_id:string|null;title:string;original_title:string;overview:string;release_date:string;genres:{id:number;name:string}[];credits:{cast:{id:number;name:string}[];crew:{id:number;name:string;job:string}[]};keywords:{keywords:{id:number;name:string}[]}};
export async function findTmdbMovie(imdbId:string){if(!/^tt\d{7,10}$/.test(imdbId))throw new Error('Geçersiz IMDb film kimliği.');return tmdbGet<{movie_results:{id:number;title:string}[]}>(`/find/${imdbId}`,{external_source:'imdb_id'});}
export async function getTmdbMovie(id:number,language='tr-TR'){if(!Number.isSafeInteger(id)||id<=0)throw new Error('Geçersiz TMDB kimliği.');return tmdbGet<TmdbMovie>(`/movie/${id}`,{append_to_response:'credits,keywords',language});}
