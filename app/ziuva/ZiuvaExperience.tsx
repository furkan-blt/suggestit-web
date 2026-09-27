'use client';
import Image from 'next/image';
import {useEffect,useRef,useState} from 'react';
import {escapeFromPointer,moods,quotes,type MoodId,type Point} from '@/lib/ziuva';
import {classifyMood} from '@/lib/ziuvaMood';

type Dust={id:number;position:Point;drift:Point};

export default function ZiuvaExperience(){
 const [input,setInput]=useState(''),[mood,setMood]=useState<MoodId|null>(null),[error,setError]=useState('');
 const [clicks,setClicks]=useState(0),[position,setPosition]=useState<Point>({x:0,y:0});
 const [expression,setExpression]=useState('notr'),[revealed,setRevealed]=useState(false),[quoteIndex,setQuoteIndex]=useState(0);
 const [dust,setDust]=useState<Dust|null>(null);
 const playSectionRef=useRef<HTMLElement>(null),stageRef=useRef<HTMLDivElement>(null),mascotRef=useRef<HTMLButtonElement>(null),locked=useRef(false);
 const unlockTimer=useRef<number|null>(null),revealTimer=useRef<number|null>(null),dustTimer=useRef<number|null>(null);
 const lastQuote=useRef<{mood:MoodId;index:number}|null>(null);
 useEffect(()=>()=>{
  for(const timer of [unlockTimer,revealTimer,dustTimer])if(timer.current!==null)window.clearTimeout(timer.current);
 },[]);
 function chooseQuote(nextMood:MoodId){
  const pool=quotes[nextMood];
  const previous=lastQuote.current?.mood===nextMood?lastQuote.current.index:-1;
  const offset=pool.length>1?1+Math.floor(Math.random()*(pool.length-1)):0;
  const index=previous<0?Math.floor(Math.random()*pool.length):(previous+offset)%pool.length;
  lastQuote.current={mood:nextMood,index};setQuoteIndex(index);
 }
 function reset(nextMood:MoodId|null){
  for(const timer of [unlockTimer,revealTimer,dustTimer])if(timer.current!==null)window.clearTimeout(timer.current);
  locked.current=false;setMood(nextMood);setClicks(0);setPosition({x:0,y:0});setExpression('notr');setRevealed(false);setDust(null);
  if(nextMood)chooseQuote(nextMood);
 }
 function submitMood(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const nextMood=classifyMood(input);
  if(!nextMood){reset(null);setError('Nasıl hissettiğini birkaç kelimeyle yazabilir misin?');return;}
  setError('');reset(nextMood);
  window.requestAnimationFrame(()=>playSectionRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
 }
 function handleMascotClick(event:React.MouseEvent<HTMLButtonElement>){
  if(!mood||revealed||locked.current)return;
  const stage=stageRef.current?.getBoundingClientRect(),mascot=mascotRef.current?.getBoundingClientRect();if(!stage||!mascot)return;
  locked.current=true;
  const pointer=event.detail===0?{x:mascot.left+mascot.width/2-stage.left,y:mascot.top+mascot.height/2-stage.top}:{x:event.clientX-stage.left,y:event.clientY-stage.top};
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   const nextPosition=escapeFromPointer({width:stage.width,height:stage.height},{width:mascot.width,height:mascot.height},position,pointer);
   setPosition(nextPosition);
   setDust({id:Date.now(),position,drift:{x:(position.x-nextPosition.x)*.34,y:(position.y-nextPosition.y)*.2}});
   if(dustTimer.current!==null)window.clearTimeout(dustTimer.current);
   dustTimer.current=window.setTimeout(()=>setDust(null),700);
  }
  const next=clicks+1;setClicks(next);setExpression(next===1?'saskin':next===2?'notr':mood);
  unlockTimer.current=window.setTimeout(()=>{locked.current=false;},470);
  if(next===3)revealTimer.current=window.setTimeout(()=>setRevealed(true),430);
 }
 const selected=moods.find(option=>option.id===mood);
 const prompt=!mood?'Önce Ziuva’ya nasıl hissettiğini anlat.':revealed?'Ziuva sana bir söz buldu.':clicks===0?'Şimdi Ziuva’ya üç kez dokun.':clicks===3?'Ziuva sözünü hazırlıyor…':`${3-clicks} dokunuş daha! Ziuva’yı yakala.`;
 const quote=mood?quotes[mood][quoteIndex]:null;
 return <main className="ziuva-page">
  <header><a className="brand" href="/" aria-label="SuggestIT ana sayfa"><img className="brand-logo" src="/logo-options/suggestit-ticket-star.png" alt="SuggestIT" width={181} height={60}/><span className="beta">BETA</span></a><a href="/" className="ziuva-back">← Film keşfine dön</a></header>
  <section className="ziuva-hero"><span className="eyebrow">SUGGESTIT STÜDYOSU / ZIUVA</span><h1>Bugün nasıl<br/><em>hissediyorsun?</em></h1><p>Ruh hâlini kendi sözlerinle anlat. Ziuva üç küçük kaçamağın ardından sana uygun bir söz fısıldasın.</p></section>
  <section className="ziuva-mood-section" aria-labelledby="ziuva-mood-title"><div className="ziuva-section-heading"><span className="ziuva-step">01</span><div><h2 id="ziuva-mood-title">Ruh hâlini anlat</h2><p>Aklından geçenleri birkaç kelimeyle yaz.</p></div></div>
   <form className="ziuva-mood-form" onSubmit={submitMood}><label htmlFor="ziuva-mood-input">Şu an nasıl hissediyorsun?</label><textarea id="ziuva-mood-input" value={input} onChange={event=>{setInput(event.target.value);setError('');if(mood)reset(null);}} maxLength={240} rows={2} placeholder="Örneğin: Bugün biraz yorgun ama umutluyum..."/><div className="ziuva-form-bottom"><span>Bir cümle yeter; Ziuva hissettiklerine en yakın ifadeyi bulur.</span><button type="submit" disabled={!input.trim()}>Ziuva’ya anlat <span aria-hidden="true">↗</span></button></div>{error?<p className="ziuva-form-error" role="alert">{error}</p>:null}</form>
  </section>
  <section ref={playSectionRef} className="ziuva-play-section" aria-labelledby="ziuva-play-title"><div className="ziuva-section-heading"><span className="ziuva-step">02</span><div><h2 id="ziuva-play-title">Ziuva’yı yakala</h2><p aria-live="polite">{prompt}</p></div></div>
   <div className={`ziuva-stage ${revealed?'has-answer':''}`} ref={stageRef}><span className="ziuva-orb orb-one" aria-hidden="true"/><span className="ziuva-orb orb-two" aria-hidden="true"/><span className="ziuva-orb orb-three" aria-hidden="true"/><span className="ziuva-stage-star star-one" aria-hidden="true">✦</span><span className="ziuva-stage-star star-two" aria-hidden="true">✳</span><span className="ziuva-stage-star star-three" aria-hidden="true">✦</span>
    <div className="ziuva-stage-label">{selected?`${selected.icon} ZIUVA’NIN YORUMU · ${selected.label.toLocaleUpperCase('tr')}`:'SENİ BEKLİYOR'}</div>
    {dust?<div key={dust.id} className="ziuva-dust" aria-hidden="true" style={{'--dust-x':`${dust.position.x}px`,'--dust-y':`${dust.position.y}px`,'--dust-drift-x':`${dust.drift.x}px`,'--dust-drift-y':`${dust.drift.y}px`} as React.CSSProperties}>{[0,1,2,3,4].map(index=><span key={index}/>)}</div>:null}
    <button ref={mascotRef} type="button" className={`ziuva-mascot ${mood?'ready':''}`} style={{'--escape-x':`${position.x}px`,'--escape-y':`${position.y}px`} as React.CSSProperties} onClick={handleMascotClick} disabled={!mood||revealed} aria-label={mood?`Ziuva’ya dokun, ${clicks} / 3`:'Önce ruh hâlini anlat'}><Image src={`/ziuva/ziuva-${expression}.png`} alt="" width={190} height={255} sizes="(max-width: 700px) 160px, 190px" priority/></button>
    <div className="ziuva-progress" aria-label={`${clicks} / 3 dokunuş`}>{[1,2,3].map(number=><span key={number} className={number<=clicks?'done':''}/>)}</div>
    {mood&&revealed&&quote?<div className="ziuva-answer" aria-live="polite"><div className="eyebrow">ZIUVA’DAN SANA</div><h2>“{quote.text}”</h2><p><span>{quote.kind}</span> · {quote.source} · <a href={quote.url} target="_blank" rel="noreferrer">Kaynağı gör ↗</a></p><small>Alıntının Türkçe çevirisi.</small><button type="button" onClick={()=>chooseQuote(mood)}>Başka bir söz gör ↗</button></div>:null}
   </div>
  </section>
  <footer><span>SuggestIT <span className="footer-separator">/</span> Ziuva’yla keşfet.</span><span>Bir ruh hâli, bir söz, küçük bir gülümseme.</span></footer>
 </main>;
}
