import {parse} from 'csv-parse/sync';
import {Profile,ProviderError} from './providers';
import type {Rating} from './engine';

/** Only personal ratings are imported. Uploaded CSV never touches disk. */
export function parseImdbCsv(csv:string):Profile {
 let rows:string[][];
 try{rows=parse(csv,{bom:true,skip_empty_lines:true,max_record_size:100_000})}
 catch{throw new ProviderError('CSV okunamadı. IMDb Ratings sayfasından dışa aktarılan orijinal CSV dosyasını seç.');}
 if(rows.length<2)throw new ProviderError('CSV dosyası boş veya puanlama kaydı içermiyor.');
 if(rows.length>20001)throw new ProviderError('En fazla 20.000 puanlama yüklenebilir.',413);
 const headers=rows[0].map(h=>h.trim().toLowerCase());
 if(new Set(headers).size!==headers.length)throw new ProviderError('CSV içinde aynı isimli birden fazla sütun var.');
 const idCol=headers.indexOf('const'),ratingCol=headers.includes('your rating')?headers.indexOf('your rating'):headers.indexOf('you rated');
 if(idCol<0||ratingCol<0)throw new ProviderError('CSV içinde Const ve Your Rating (eski biçimde You rated) sütunları gerekli. Watchlist yerine puanlamalarını (Ratings) dışa aktar.');
 const typeCol=headers.indexOf('title type'),dateCol=headers.includes('date rated')?headers.indexOf('date rated'):headers.indexOf('created');
 const titleCol=headers.indexOf('title'),yearCol=headers.indexOf('year');
 let invalid=0,nonMovie=0,duplicate=0;
 const byId=new Map<string,{rating:Rating;date:string}>();
 for(const row of rows.slice(1)){
  const id=row[idCol]?.trim(),rating=Number(row[ratingCol]?.trim());
  if(!/^tt\d{7,10}$/.test(id)||!Number.isInteger(rating)||rating<1||rating>10){invalid++;continue;}
  const type=typeCol<0?'':row[typeCol].trim().toLowerCase().replace(/[\s_-]/g,'');
  if(type&&!['movie','featurefilm','documentary','tvmovie','short','tvshort','video'].includes(type)){nonMovie++;continue;}
  const rawDate=dateCol<0?'':row[dateCol].trim();
  const date=normalizeRatingDate(rawDate);
  const old=byId.get(id);
  if(old){duplicate++;if(old.date>date)continue;}
  const title=titleCol<0?'':row[titleCol]?.trim().slice(0,250),year=yearCol<0?'':row[yearCol]?.trim();
  byId.set(id,{rating:{imdbId:id,rating:rating/2,...(title?{title}:{}),...(/^\d{4}$/.test(year)?{year}:{})},date});
 }
 if(!byId.size)throw new ProviderError('CSV içinde geçerli film puanı bulunamadı. Kişisel puanlar 1–10 aralığında olmalı.');
 const warnings=['Yalnızca CSV’deki puanlanmış filmler biliniyor; puan vermeden izlediklerin önerilebilir.'];
 if(invalid)warnings.push(`${invalid} geçersiz puanlama satırı atlandı.`);
 if(nonMovie)warnings.push(`${nonMovie} dizi, bölüm veya film dışı kayıt öneri geçmişine alınmadı.`);
 if(duplicate)warnings.push(`${duplicate} tekrar kayıt birleştirildi; tarih varsa en yeni puan kullanıldı.`);
 return {name:'IMDb CSV profilin',source:'imdb-csv',ratings:[...byId.values()].map(x=>x.rating),warnings};
}

export function normalizeRatingDate(value:string):string {
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value)))return value;
 const old=value.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+\d{2}:\d{2}:\d{2}\s+(\d{4})$/);
 if(!old)return '';
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(old[1])+1;
 return month?`${old[3]}-${String(month).padStart(2,'0')}-${old[2].padStart(2,'0')}`:'';
}
