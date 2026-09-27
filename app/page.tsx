'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import TasteGraph from './TasteGraph';
import type {TasteGraph as TasteGraphData} from '@/lib/graph';
type Film={id:number;title:string;year:string;genres:string[];imdbId:string;score:number;reason:string};
type Result={profile:string;source:string;matched:number;total:number;warnings:string[];graph:TasteGraphData;recommendations:Film[];weights:number[]};
const cards=[
 {title:'YENİ DÜNYALAR',label:'01 / KEŞİF',tone:'violet'},
 {title:'GÜZEL HİKÂYELER',label:'02 / HİKÂYE',tone:'peach'},
 {title:'SIRADAKİ FAVORİN',label:'03 / FİLM',tone:'mint'},
];
const minimumLoadingMs=3400;
function RecommendationLoading(){
 const [index,setIndex]=useState(0);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const interval=window.setInterval(()=>setIndex(i=>(i+1)%cards.length),1150);return()=>window.clearInterval(interval)},[]);
 return <div className="loading-backdrop" role="status" aria-live="polite" aria-label="Film önerileri hazırlanıyor">
  <div className="loading-stage">
   <div className="loading-kicker"><span className="loading-sparkle" aria-hidden="true">✦</span> SUGGESTIT STÜDYOSU</div>
   <div className="poster-deck" aria-live="off">
    {[-1,0,1].map(offset=>{const card=cards[(index+offset+cards.length)%cards.length];return <div className={`poster-slot poster-slot-${offset+1} poster-${card.tone}`} key={`${card.tone}-${offset}`} aria-hidden="true"><span className="poster-mark">✦</span><strong>{card.title}</strong><small>{card.label}</small></div>})}
   </div>
   <div className="loading-copy"><div className="loading-orbit" aria-hidden="true"><span/></div><h2>Hikâyeler eşleşiyor<span className="loading-ellipsis" aria-hidden="true">...</span></h2><p>Film zevkini keşfediyor, sıradaki favorini arıyoruz.</p></div>
   <div className="loading-progress" aria-hidden="true"><span/></div>
  </div>
 </div>
}
export default function Home(){
 const [platform,setPlatform]=useState('letterboxd'); const [nickname,setNickname]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState<Result|null>(null);
 const [csv,setCsv]=useState<File|null>(null);
 const pending=useRef(false);
 const resultsRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(busy||!result)return;const frame=window.requestAnimationFrame(()=>{resultsRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});resultsRef.current?.querySelector('h2')?.focus({preventScroll:true})});return()=>window.cancelAnimationFrame(frame)},[busy,result]);
 const run=useCallback(async(p:string,n:string)=>{if(pending.current)throw new Error('Bir arama zaten sürüyor.');if(!['letterboxd','imdb','demo'].includes(p)||!n.trim()||n.length>200)throw new Error('Geçerli platform ve kullanıcı adı gerekli.');pending.current=true;const started=Date.now();setBusy(true);setError('');setResult(null);if(p!=='demo'){setPlatform(p);setNickname(n)}try{const r=await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:p,nickname:n})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Öneriler hazırlanamadı.');await new Promise(resolve=>setTimeout(resolve,Math.max(0,minimumLoadingMs-(Date.now()-started))));flushSync(()=>setResult(d));return {profile:d.profile,count:d.recommendations.length,warnings:d.warnings}}catch(e){setError(e instanceof Error?e.message:'Bağlantı kurulamadı.');throw e}finally{pending.current=false;setBusy(false)}},[]);
 async function recommend(demo=false){await run(demo?'demo':platform,demo?'movielens-414':nickname).catch(()=>{})}
 async function uploadCsv(){
  if(pending.current)return;
  if(!csv){setError('IMDb puanlarını içeren CSV dosyasını seç.');return;}
  if(csv.size>2_000_000){setError('CSV dosyası en fazla 2 MB olabilir.');return;}
  pending.current=true;const started=Date.now();setBusy(true);setError('');setResult(null);
  try{const r=await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'text/csv; charset=utf-8'},body:csv});const d=await r.json();if(!r.ok)throw new Error(d.error||'CSV işlenemedi.');await new Promise(resolve=>setTimeout(resolve,Math.max(0,minimumLoadingMs-(Date.now()-started))));setResult(d);}
  catch(e){setError(e instanceof Error?e.message:'CSV yüklenemedi.');}finally{pending.current=false;setBusy(false);}
 }
 useEffect(()=>{const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>unknown}}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{void Promise.resolve(context.registerTool({name:'find_film_recommendations',description:'Profilin erişilebilen film geçmişine göre öneriler getirir ve sayfada gösterir.',inputSchema:{type:'object',properties:{platform:{type:'string',enum:['letterboxd','imdb','demo']},nickname:{type:'string',minLength:1,maxLength:200}},required:['platform','nickname'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input:unknown)=>{if(!input||typeof input!=='object'||!('platform'in input)||!('nickname'in input)||typeof input.platform!=='string'||typeof input.nickname!=='string')throw new Error('Platform ve kullanıcı adı gerekli.');return run(input.platform,input.nickname)}},{signal:lifecycle.signal})).catch(()=>{})}catch{}return()=>lifecycle.abort()},[run]);
 return <main>
 <header><a className="brand" href="/" aria-label="SuggestIT ana sayfa"><img className="brand-logo" src="/logo-options/suggestit-ticket-star.png" alt="SuggestIT" width={181} height={60}/><span className="beta">BETA</span></a><span className="header-note">İyi bir film, yeni bir dünya.</span></header>
 <section className="intro"><div className="eyebrow">SENİN ZEVKİN. YENİ HİKÂYELER.</div><h1>Bu akşam<br/><em>ne izlesek?</em></h1><p>Sevdiğin filmlerden yola çık.<br/>Henüz tanışmadığın hikâyeleri bul.</p></section>
 <section className="search-panel" aria-label="Profilinden film önerisi al">
 <div className="platforms" role="group" aria-label="Keşif yöntemi">{['letterboxd','imdb'].map(p=><button key={p} aria-pressed={platform===p} className={platform===p?'active':''} disabled={busy} onClick={()=>{setPlatform(p);setError('');setResult(null)}}>{p==='letterboxd'?<><span className="lb-dots">●●●</span> Letterboxd</>:<><span className="imdb-logo">IMDb</span> IMDb</>}</button>)}<a className="ziuva-entry" href="/ziuva" aria-label="Ziuva ile ruh hâline göre bir söz keşfet"><span aria-hidden="true">✦</span> Ziuva</a></div>
 {platform==='letterboxd'?<form onSubmit={e=>{e.preventDefault();void recommend()}}><label htmlFor="nickname">Letterboxd kullanıcı adın</label><div className="input-row"><span className="at">@</span><input id="nickname" autoComplete="off" required maxLength={200} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="kullanıcı adını yaz" disabled={busy}/><button className="submit" disabled={busy}>{busy?'Hazırlanıyor…':'Filmlerimi bul'} <span aria-hidden="true">↗</span></button></div></form>:<form onSubmit={e=>{e.preventDefault();void uploadCsv()}}><label htmlFor="imdb-csv">IMDb puanlama dosyan (CSV)</label><p className="upload-help" id="csv-help">IMDb’de Your ratings sayfasından Export ile aldığın CSV dosyasını seç. En fazla 2 MB ve 20.000 kayıt.</p><div className="input-row"><input id="imdb-csv" type="file" accept=".csv,text/csv" aria-describedby="csv-help" required disabled={busy} onChange={e=>{setCsv(e.target.files?.[0]||null);setError('');setResult(null)}}/><button className="submit" disabled={busy||!csv}>{busy?'İşleniyor…':'Puanlarımdan öner'} <span aria-hidden="true">↗</span></button></div><p className="upload-help">Dosya bu sunucuda işlenir; diske kaydedilmez ve TMDB’ye gönderilmez.</p></form>}
 <div className="search-foot"><span>Yalnızca erişilebilen profil verileri kullanılır.</span><button className="text-button" disabled={busy} onClick={()=>recommend(true)}>Örnek profille dene →</button></div>
 <p className="connection-note">Araştırma sürümü · Letterboxd için son RSS etkinlikleri, IMDb için yüklediğin CSV’deki kişisel film puanları kullanılır. 2019 sonrası filmler TMDB içerikleriyle eklenir.</p>
 </section>
 <div aria-live="polite">{error&&<div className="error" role="alert">{error}</div>}</div>{busy&&<RecommendationLoading/>}
 {result?<section className="results" ref={resultsRef}><div className="results-heading"><div className="eyebrow">{result.source==='demo'?'ÖRNEK PROFİL · MOVIELENS':'PROFİLİNE GÖRE'}</div><h2 tabIndex={-1}>İzleme haritan ve önerilerin</h2><p>{result.profile} · {result.matched} / {result.total} film katalogda eşleşti</p></div>{result.warnings.map(w=><p className="notice" key={w}>{w}</p>)}<TasteGraph graph={result.graph}/><div className="recommendations-heading"><div className="eyebrow">SANA ÖZEL SEÇKİ</div><h2>Sıradaki favorilerin</h2></div><div className="film-grid">{result.recommendations.map((f,i)=><article key={f.id} className="film-card"><div className="film-top"><span className="rank">{String(i+1).padStart(2,'0')}</span><span className="match">{(f.score*100).toFixed(2)} / 100</span></div><div className="film-body"><p className="film-year">{f.year} · {f.genres.slice(0,2).join(' / ')}</p><h3>{f.title}</h3><p className="reason">{f.reason}</p><a href={`https://www.imdb.com/title/${f.imdbId}/`} target="_blank" rel="noreferrer">IMDb’de incele ↗</a></div></article>)}</div><p className="score-note">Puanlar göreli sıralama skorudur; beğenme olasılığı değildir. İzlenenler erişilebilen geçmiş ölçüsünde elenir.</p></section>:<section className="how"><div><span>01 / PROFİLİN</span><h3>Bir kullanıcı adıyla başla.</h3><p>Erişilebilen izleme geçmişin ve verdiğin puanlar başlangıç noktamız.</p></div><div><span>02 / ZEVKİN</span><h3>Bağlantıları keşfet.</h3><p>Ortak beğeniler, film türleri ve filmler arasındaki ilişkiler birlikte değerlendirilir.</p></div><div><span>03 / KEŞFİN</span><h3>Yeni bir favori bul.</h3><p>Önerinin gerekçesini gör, filmini seç ve yeni bir hikâyeye adım at.</p></div></section>}
 <footer><span>SuggestIT <span className="footer-separator">/</span> keşfetmeye devam et.</span><span>MovieLens işbirlikçi eğitim · TMDB güncel içerik kataloğu<br/>This product uses the TMDB API but is not endorsed or certified by TMDB.</span></footer>
 </main>
}
