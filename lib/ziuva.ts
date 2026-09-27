export const moods=[
 {id:'mutlu',label:'Mutlu',icon:'✦',color:'#ffd36b'},
 {id:'huzunlu',label:'Hüzünlü',icon:'☂',color:'#a8b9ff'},
 {id:'kaygili',label:'Kaygılı',icon:'≈',color:'#b9a7ff'},
 {id:'yorgun',label:'Yorgun',icon:'☾',color:'#b9d5d3'},
 {id:'ofkeli',label:'Öfkeli',icon:'⚡',color:'#ff9a8f'},
 {id:'romantik',label:'Romantik',icon:'♡',color:'#ff9bc5'},
 {id:'umutlu',label:'Umutlu',icon:'✳',color:'#a8e5ad'},
 {id:'nostaljik',label:'Nostaljik',icon:'◌',color:'#eac0a4'},
 {id:'heyecanli',label:'Heyecanlı',icon:'✺',color:'#ffc78a'},
 {id:'sakin',label:'Sakin',icon:'☼',color:'#99dcdb'},
] as const;
export type MoodId=(typeof moods)[number]['id'];
export type ZiuvaQuote={text:string;source:string;kind:'Film'|'Düşünür';url:string};
// Turkish translations of the linked, verified original lines.
export const quotes:Record<MoodId,readonly ZiuvaQuote[]>={
 mutlu:[
  {text:'Dünyanın kralıyım!',source:'Titanic (1997)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
  {text:'Küçük şeylerin sevincinde kalp sabahını bulur.',source:'Halil Cibran · Ermiş, Dostluk Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Haz, özgürlüğün şarkısıdır.',source:'Halil Cibran · Ermiş, Haz Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Bugün kendimi dünyanın en şanslı insanı sayıyorum.',source:'The Pride of the Yankees (1943)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 huzunlu:[
  {text:'Sevincin, maskesi düşmüş kederindir.',source:'Halil Cibran · Ermiş, Neşe ve Keder Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Keder içinde ne kadar derin oyulursan, o kadar çok sevinç taşıyabilirsin.',source:'Halil Cibran · Ermiş, Neşe ve Keder Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Acın, anlayışını saran kabuğun kırılmasıdır.',source:'Halil Cibran · Ermiş, Acı Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Bir şey olabilirdim.',source:'On the Waterfront (1954)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 kaygili:[
  {text:'Bazı şeyler elimizdedir; bazıları değildir.',source:'Epiktetos · Enchiridion, I',kind:'Düşünür',url:'https://www.gutenberg.org/files/45109/45109-h/45109-h.htm'},
  {text:'Gelecek için kaygılanma; gerekirse ona bugünkü aklınla varacaksın.',source:'Marcus Aurelius · Düşünceler, VII.8',kind:'Düşünür',url:'https://www.gutenberg.org/files/55317/55317-h/55317-h.htm'},
  {text:'Önce kendine biraz zaman tanı; sonra kendini daha kolay yönetirsin.',source:'Epiktetos · Enchiridion, XX',kind:'Düşünür',url:'https://www.gutenberg.org/files/45109/45109-h/45109-h.htm'},
  {text:'Yüzmeye devam et.',source:'Finding Nemo (2003)',kind:'Film',url:'https://movies.disney.com/finding-nemo'},
 ],
 yorgun:[
  {text:'Dinlenmek, boş durmak değildir.',source:'John Lubbock',kind:'Düşünür',url:'https://www.gutenberg.org/files/69627/old/69627-h/69627-h.htm'},
  {text:'Doğa, yeme ve içme gibi dinlenmeye de bir ölçü koymuştur.',source:'Marcus Aurelius · Düşünceler, V.1',kind:'Düşünür',url:'https://www.gutenberg.org/files/55317/55317-h/55317-h.htm'},
  {text:'Öğle vakti durup sevgiyi düşünmek de sevgidir.',source:'Halil Cibran · Ermiş, Aşk Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Yalnız kalmak istiyorum.',source:'Grand Hotel (1932)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 ofkeli:[
  {text:'Dalgaların çarptığı kaya gibi ol; o yerinde durur.',source:'Marcus Aurelius · Düşünceler, IV.49',kind:'Düşünür',url:'https://www.gutenberg.org/files/55317/55317-h/55317-h.htm'},
  {text:'Onlara anlat; ama öfkelenmeden.',source:'Marcus Aurelius · Düşünceler, VI.27',kind:'Düşünür',url:'https://www.gutenberg.org/files/55317/55317-h/55317-h.htm'},
  {text:'Seni öfkelendiren olay değil, ona dair yargındır.',source:'Epiktetos · Enchiridion, XX',kind:'Düşünür',url:'https://www.gutenberg.org/files/45109/45109-h/45109-h.htm'},
  {text:'Çılgına döndüm ve buna daha fazla katlanmayacağım!',source:'Network (1976)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 romantik:[
  {text:'Merhaba dediğinde beni kazanmıştın.',source:'Jerry Maguire (1996)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
  {text:'Sevgi, özür dilemek zorunda kalmamaktır.',source:'Love Story (1970)',kind:'Film',url:'https://catalog.afi.com/Film/20649-LOVE-STORY'},
  {text:'Sevgi kendinden başka bir şey vermez; kendinden başka bir şey almaz.',source:'Halil Cibran · Ermiş, Aşk Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Nasıl dilersen.',source:'The Princess Bride (1987)',kind:'Film',url:'https://www.afi.com/news/afi-movie-club-the-princess-bride/'},
 ],
 umutlu:[
  {text:'Ne de olsa yarın başka bir gün.',source:'Gone with the Wind (1939)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
  {text:'Hayat geriye gitmez; dünle oyalanmaz.',source:'Halil Cibran · Ermiş, Çocuklar Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Günü yakala. Hayatını olağanüstü kıl.',source:'Dead Poets Society (1989)',kind:'Film',url:'https://www.afi.com/news/dead-poets-society-afi-movie-club/'},
  {text:'Onu inşa edersen, gelecektir.',source:'Field of Dreams (1989)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 nostaljik:[
  {text:'Ev gibisi yok.',source:'The Wizard of Oz (1939)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
  {text:'Dün, bugünün anısı; yarın, bugünün düşüdür.',source:'Halil Cibran · Ermiş, Zaman Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Sevdiğin şey, yokluğunda daha belirgin olabilir.',source:'Halil Cibran · Ermiş, Dostluk Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Paris hep bizim olacak.',source:'Casablanca (1942)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 heyecanli:[
  {text:'Güç seninle olsun.',source:'Star Wars (1977)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
  {text:'Sonsuzluğa ve ötesine!',source:'Toy Story (1995)',kind:'Film',url:'https://news.disney.com/disney-pixar-quotes-to-inspire-your-day'},
  {text:'Çalışmak, görünür hâle gelmiş sevgidir.',source:'Halil Cibran · Ermiş, Çalışma Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Kemerlerinizi bağlayın; sarsıntılı bir gece olacak.',source:'All About Eve (1950)',kind:'Film',url:'https://www.afi.com/afis-100-years-100-movie-quotes/'},
 ],
 sakin:[
  {text:'İnsan kendi ruhundan daha sessiz bir sığınak bulamaz.',source:'Marcus Aurelius · Düşünceler, IV.3',kind:'Düşünür',url:'https://www.gutenberg.org/files/55317/55317-h/55317-h.htm'},
  {text:'Kendi içine çekil; orada huzur bulabilirsin.',source:'Marcus Aurelius · Düşünceler, VII.28',kind:'Düşünür',url:'https://www.gutenberg.org/files/55317/55317-h/55317-h.htm'},
  {text:'Mantıkta dinlen; tutkuyla harekete geç.',source:'Halil Cibran · Ermiş, Akıl ve Tutku Üzerine',kind:'Düşünür',url:'https://www.gutenberg.org/cache/epub/58585/pg58585-images.html'},
  {text:'Hakuna Matata: Dert yok.',source:'The Lion King (1994)',kind:'Film',url:'https://silver.afi.com/movies/detail/0100004905/'},
 ],
};

export type Point={x:number;y:number};
export function escapeFromPointer(stage:{width:number;height:number},mascot:{width:number;height:number},position:Point,pointer:Point,step=92):Point{
 const maxX=Math.max(0,(stage.width-mascot.width)/2-12),maxY=Math.max(0,(stage.height-mascot.height)/2-12);
 const clamp=(value:number,max:number)=>Math.max(-max,Math.min(max,value));
 const directions:[number,number][]=[[1,0],[-1,0],[0,1],[0,-1],[.71,.71],[.71,-.71],[-.71,.71],[-.71,-.71]];
 const options=directions.map(([dx,dy])=>({x:clamp(position.x+dx*step,maxX),y:clamp(position.y+dy*step,maxY)}))
  .filter(next=>Math.hypot(next.x-position.x,next.y-position.y)>12);
 if(!options.length)return position;
 const distance=(point:Point)=>Math.hypot(stage.width/2+point.x-pointer.x,stage.height/2+point.y-pointer.y);
 return options.sort((a,b)=>(distance(b)-distance(a))||Math.hypot(b.x-position.x,b.y-position.y)-Math.hypot(a.x-position.x,a.y-position.y))[0];
}
