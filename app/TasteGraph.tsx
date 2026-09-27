'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {TasteGraph as TasteGraphData,GraphNode} from '@/lib/graph';

type Point={x:number;y:number};
type Layout={positions:Map<number,Point>;centers:Map<string,Point>;colors:Map<string,string>};
function makeLayout(graph:TasteGraphData):Layout{
 const centers=new Map<string,Point>(),colors=new Map<string,string>();
 const placed:{x:number;y:number;r:number}[]=[];
 graph.groups.forEach((group,index)=>{
  const radius=Math.sqrt(group.count)*12+42;
  let point={x:0,y:0};
  if(index){for(let attempt=1;attempt<20000;attempt++){
   const angle=attempt*2.399963,reach=30*Math.sqrt(attempt);
   const candidate={x:Math.cos(angle)*reach,y:Math.sin(angle)*reach};
   if(placed.every(other=>Math.hypot(candidate.x-other.x,candidate.y-other.y)>radius+other.r+35)){point=candidate;break;}
  }}
  centers.set(group.name,point);colors.set(group.name,`hsl(${Math.round((index*137.5+264)%360)} 77% 72%)`);placed.push({...point,r:radius});
 });
 const positions=new Map<number,Point>(),within=new Map<string,number>();
 const ordered=[...graph.nodes].sort((a,b)=>a.group.localeCompare(b.group)||(b.rating??3)-(a.rating??3)||a.id-b.id);
 for(const node of ordered){const index=within.get(node.group)??0;within.set(node.group,index+1);const center=centers.get(node.group)!;
  const angle=index*2.399963,radius=12*Math.sqrt(index);
  positions.set(node.id,{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius});
 }
 return {positions,centers,colors};
}
export default function TasteGraph({graph}:{graph:TasteGraphData}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null),drawRef=useRef<()=>void>(()=>{}),cameraRef=useRef({x:0,y:0,scale:1}),manualRef=useRef(false);
 const [visibleCount,setVisibleCount]=useState(0),[selected,setSelected]=useState<number|null>(null),[activeGroup,setActiveGroup]=useState<string|null>(null),[replay,setReplay]=useState(0),[query,setQuery]=useState('');
 const selectedRef=useRef<number|null>(null),groupRef=useRef<string|null>(null),visibleRef=useRef(0);
 const layout=useMemo(()=>makeLayout(graph),[graph]);
 const byId=useMemo(()=>new Map(graph.nodes.map(node=>[node.id,node])),[graph]);
 const rank=useMemo(()=>new Map(graph.reveal.map((id,index)=>[id,index])),[graph]);
 const strongest=graph.edges[0],selectedNode=selected===null?null:byId.get(selected);
 const related=selected===null?null:graph.edges.filter(edge=>edge.source===selected||edge.target===selected).sort((a,b)=>b.strength-a.strength).slice(0,3);
 useEffect(()=>{selectedRef.current=selected;groupRef.current=activeGroup;drawRef.current();},[selected,activeGroup]);
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;const context=canvas.getContext('2d');if(!context)return;
  let frame=0,lastStatus=0,started=0,done=false,settle=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  manualRef.current=false;visibleRef.current=reduced?graph.nodes.length:Math.min(2,graph.nodes.length);setVisibleCount(visibleRef.current);
  cameraRef.current={x:0,y:0,scale:1};
  const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);drawRef.current();};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function draw(){if(!canvas||!context)return;const width=canvas.clientWidth,height=canvas.clientHeight,dpr=canvas.width/Math.max(width,1);if(!width||!height)return;
   const visible=new Set(graph.reveal.slice(0,visibleRef.current));const camera=cameraRef.current;
   if(!manualRef.current&&visible.size){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const id of visible){const point=layout.positions.get(id)!;minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
    const targetScale=Math.min(2.3,Math.max(.14,Math.min((width-110)/(maxX-minX+95),(height-120)/(maxY-minY+95))));
    const factor=reduced?1:visibleRef.current<=2?.28:.12;
    camera.x+=(minX/2+maxX/2-camera.x)*factor;camera.y+=(minY/2+maxY/2-camera.y)*factor;camera.scale+=(targetScale-camera.scale)*factor;
   }
   context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
   const project=(point:Point)=>({x:(point.x-camera.x)*camera.scale+width/2,y:(point.y-camera.y)*camera.scale+height/2});
   for(const edge of graph.edges){if(!visible.has(edge.source)||!visible.has(edge.target))continue;
    const source=byId.get(edge.source)!,target=byId.get(edge.target)!;
    const selectedId=selectedRef.current,group=groupRef.current;
    const highlighted=selectedId!==null&&(edge.source===selectedId||edge.target===selectedId);
    const faded=(selectedId!==null&&!highlighted)||(group!==null&&source.group!==group&&target.group!==group);
    const a=project(layout.positions.get(edge.source)!),b=project(layout.positions.get(edge.target)!);
    context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);
    context.strokeStyle=highlighted?'rgba(245,226,255,.85)':faded?'rgba(190,180,218,.035)':`rgba(191,177,231,${Math.min(.47,.07+edge.strength*.52)})`;
    context.lineWidth=highlighted?2.2:Math.max(.45,edge.strength*2.2);context.stroke();
   }
   if(visible.size>10&&camera.scale>.42){context.textAlign='center';context.font='600 11px DM Sans, sans-serif';
    for(const group of graph.groups){const center=layout.centers.get(group.name)!;const anchor=project(center);if(anchor.x<0||anchor.x>width||anchor.y<0||anchor.y>height)continue;
     context.fillStyle=layout.colors.get(group.name)!;context.globalAlpha=groupRef.current&&groupRef.current!==group.name?.25:.65;context.fillText(group.name.toLocaleUpperCase('tr'),anchor.x,anchor.y-Math.sqrt(group.count)*12*camera.scale-13);context.globalAlpha=1;
    }
   }
   const neighbors=new Set<number>();if(selectedRef.current!==null)for(const edge of graph.edges){if(edge.source===selectedRef.current)neighbors.add(edge.target);if(edge.target===selectedRef.current)neighbors.add(edge.source);}
   for(const node of graph.nodes){if(!visible.has(node.id))continue;const point=project(layout.positions.get(node.id)!);if(point.x<-15||point.x>width+15||point.y<-15||point.y>height+15)continue;
    const chosen=selectedRef.current===node.id,dim=(selectedRef.current!==null&&!chosen&&!neighbors.has(node.id))||(groupRef.current!==null&&node.group!==groupRef.current);
    const radius=Math.max(1.5,Math.min(7,(node.rating?2.3+node.rating*.62:4.4)*Math.sqrt(camera.scale)));
    context.beginPath();context.arc(point.x,point.y,chosen?radius+3:radius,0,Math.PI*2);
    context.fillStyle=layout.colors.get(node.group)!;context.globalAlpha=dim?.22:node.rating&&node.rating<=2?.58:1;
    if(chosen||node.rating&&node.rating>=4.5){context.shadowColor=context.fillStyle;context.shadowBlur=chosen?22:9;}context.fill();context.shadowBlur=0;context.globalAlpha=1;
    if(chosen){context.strokeStyle='#fff';context.lineWidth=2;context.stroke();context.fillStyle='#fff';context.textAlign='center';context.font='600 13px DM Sans, sans-serif';context.fillText(node.label.slice(0,30),point.x,point.y-radius-12);}
   }
  }
  drawRef.current=draw;
  function tick(time:number){if(!started)started=time;
   if(!reduced){const elapsed=time-started;const progress=Math.max(0,Math.min(1,(elapsed-650)/6600));visibleRef.current=Math.min(graph.nodes.length,Math.max(2,Math.floor(2+(graph.nodes.length-2)*progress*progress)));
    if(time-lastStatus>110||progress===1){setVisibleCount(visibleRef.current);lastStatus=time;}
    if(progress===1)settle++;done=settle>40;
   }else done=true;
   draw();if(!done)frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[graph,layout,byId,replay]);
 function zoom(multiplier:number){const camera=cameraRef.current;camera.scale=Math.max(.12,Math.min(4,camera.scale*multiplier));manualRef.current=true;drawRef.current();}
 function fitAll(){const canvas=canvasRef.current;if(!canvas||!layout.positions.size)return;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const point of layout.positions.values()){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}cameraRef.current={x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.min((canvas.clientWidth-110)/(maxX-minX+95),(canvas.clientHeight-120)/(maxY-minY+95))};manualRef.current=true;drawRef.current();}
 function findFilm(event:React.FormEvent){event.preventDefault();const term=query.trim().toLocaleLowerCase('tr');if(!term)return;const found=graph.nodes.find(node=>node.label.toLocaleLowerCase('tr').includes(term));if(found){setSelected(found.id);manualRef.current=true;const point=layout.positions.get(found.id)!;cameraRef.current.x=point.x;cameraRef.current.y=point.y;cameraRef.current.scale=Math.max(cameraRef.current.scale,1.1);drawRef.current();}}
 function clickCanvas(event:React.MouseEvent<HTMLCanvasElement>){const canvas=canvasRef.current;if(!canvas)return;const rect=canvas.getBoundingClientRect(),camera=cameraRef.current;
  const world={x:(event.clientX-rect.left-rect.width/2)/camera.scale+camera.x,y:(event.clientY-rect.top-rect.height/2)/camera.scale+camera.y};
  let best:GraphNode|undefined,distance=Infinity;for(const node of graph.nodes){if((rank.get(node.id)??Infinity)>=visibleRef.current)continue;const point=layout.positions.get(node.id)!;const d=Math.hypot(point.x-world.x,point.y-world.y);if(d<distance){best=node;distance=d;}}
  if(best&&distance<Math.max(12,16/camera.scale))setSelected(best.id);
 }
 const drag=useRef<{x:number;y:number}|null>(null),moved=useRef(false);
 return <section className="taste-section" aria-labelledby="taste-title">
  <div className="taste-intro"><div><div className="eyebrow">İZLEME HARİTAN</div><h3 id="taste-title">Filmler arasındaki bağlar</h3><p>Önce en güçlü bağ belirir; ardından izlediğin tüm filmler tür, yönetmen, oyuncu ve konu ortaklıklarına göre açılır.</p></div><div className="taste-counts"><span><strong>{visibleCount}</strong> / {graph.watched} film</span><span><strong>{graph.groups.length}</strong> ilgi kümesi</span></div></div>
  <div className="taste-board"><div className="taste-toolbar"><span className="taste-live">{visibleCount<graph.watched?'Ağ oluşuyor…':'Tüm geçmiş gösteriliyor'}</span><div className="taste-zoom"><button type="button" onClick={()=>zoom(1/1.25)} aria-label="Grafiği uzaklaştır">−</button><button type="button" onClick={fitAll} aria-label="Grafiği ekrana sığdır">Sığdır</button><button type="button" onClick={()=>zoom(1.25)} aria-label="Grafiği yakınlaştır">+</button><button type="button" onClick={()=>{setSelected(null);setActiveGroup(null);setReplay(value=>value+1);}} aria-label="Ağın oluşumunu yeniden oynat">↺</button></div></div>
   <canvas ref={canvasRef} className="taste-canvas" role="img" aria-label={`${graph.watched} izlenen film arasındaki tür, yönetmen, oyuncu ve anahtar kelime ilişkileri`} onClick={event=>{if(!moved.current)clickCanvas(event);moved.current=false;}} onPointerDown={event=>{moved.current=false;drag.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(!drag.current)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>2){moved.current=true;manualRef.current=true;cameraRef.current.x-=dx/cameraRef.current.scale;cameraRef.current.y-=dy/cameraRef.current.scale;drag.current={x:event.clientX,y:event.clientY};drawRef.current();}}} onPointerUp={()=>{drag.current=null}}/>
   <div className="taste-overlay"><div className="taste-groups" aria-label="İlgi kümeleri">{graph.groups.slice(0,8).map(group=><button type="button" key={group.name} className={activeGroup===group.name?'active':''} onClick={()=>setActiveGroup(value=>value===group.name?null:group.name)}><i style={{background:layout.colors.get(group.name)}}/>{group.name}<small>{group.count}</small></button>)}</div>
   <form className="taste-search" onSubmit={findFilm}><input aria-label="Grafikte film ara" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Grafikte film ara"/><button type="submit">Bul</button></form></div>
  </div>
  <div className="taste-detail"><div><span className="detail-kicker">{selectedNode?'İZLENEN FİLM':'EN GÜÇLÜ BAĞ'}</span><strong>{selectedNode?selectedNode.label:strongest?`${byId.get(strongest.source)?.label} ↔ ${byId.get(strongest.target)?.label}`:'İzleme geçmişin'}</strong></div><p>{selectedNode?`${selectedNode.year}${selectedNode.rating?` · Puanın ${selectedNode.rating}/5`:' · Puan belirtilmemiş'} · ${selectedNode.group}`:strongest?.patterns.join(' · ')??'Eşleşen filmlerde ortak metadata bulunamadı.'}</p>{related?.length?<p className="taste-related">Güçlü bağları: {related.map(edge=>`${byId.get(edge.source===selected?edge.target:edge.source)?.label} (${edge.patterns.slice(0,2).join(', ')})`).join(' · ')}</p>:null}</div>
  <p className="taste-note">Renkler ilgi kümelerini, çizgiler ortak özellikleri gösterir. Yönetmen, oyuncu ve anahtar kelime verisi yalnızca katalogda bulunduğu filmlerde kullanılır. Puanlar bağ gücünü ve vurguyu etkiler; düşük puanlı filmler de görünür.</p>
 </section>;
}
