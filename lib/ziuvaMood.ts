import type {MoodId} from './ziuva';

// The free-text prompt stays on the device. Match common Turkish expressions to
// the existing illustrated moods, then use a neutral fallback for unfamiliar wording.
const signals:Record<MoodId,RegExp[]>={
 mutlu:[/(?<![a-zçğıöşü])mutlu|neşel|nesel|keyifl|sevin|gül|gul|harika|şahane|sahane|çok iyi|cok iyi|güzel hiss|guzel hiss|iyiyim|iyi hissed|moralim yüksek|enerjim yerinde/],
 huzunlu:[/üzgün|uzgun|hüzün|huzun|mutsuz|keder|ağla|agla|yalnız|yalniz|kırgın|kirgin|boşluk|bosluk|içim buruk|icim buruk|kalbim kırık|kalbim kirik|moralim bozuk|kötü hiss|kotu hiss|kötüyüm|kotuyum|canım sıkkın|canim sikkin/],
 kaygili:[/kayg|endiş|endis|stres|gergin|tedirgin|panik|kork|huzursuz|bunald|bunali|aklım karış|aklim karis|kafam karış|kafam karis|gelecekten çekin|gelecekten cekin|sınav|sinav|bilemiyorum|belirsiz|kararsız|kararsiz/],
 yorgun:[/yorgun|bitkin|tüken|tuken|uykusuz|uyku|enerjim yok|halsiz|yoruld|dinlen|çok iş|cok is|pilim bitti|hastayım|hastayim/],
 ofkeli:[/öfk|ofk|sinir|kızgın|kizgin|hiddet|delir|nefret|çıldır|cildir|kudur/],
 romantik:[/aşk|ask|âşık|aşık|asik|sevdiğim|sevdigim|sevgili|romantik|kalbim çarp|kalbim carp|flört|flort|hoşlan|hoslan/],
 umutlu:[/umut|iyimser|başaracağ|basaracag|olacak|düzelecek|duzelecek|yeniden baş|yeniden bas|inanıyorum|inaniyorum|ışık var|isik var/],
 nostaljik:[/nostalj|eskiler|eskiden|geçmiş|gecmis|çocukluğ|cocuklug|hatıra|hatira|anıla|anila|o günler|o gunler|dünleri|dunleri|özlem|ozlem|özlüyorum|ozluyorum/],
 heyecanli:[/heyecan|sabırsız|sabirsiz|adrenalin|yerimde duram|coşku|cosku|kıpır kıpır|kipir kipir|dört gözle|dort gozle/],
 sakin:[/sakin|huzur|dingin|rahat|ferah|içim açık|icim acik|meditasyon|sessiz|dengede/],
};

export function classifyMood(input:string):MoodId|null{
 const text=input.trim().toLocaleLowerCase('tr-TR').normalize('NFKC');
 if(!/[a-zçğıöşü]/i.test(text))return null;
 // Explicit negation should not become a positive mood just because its name appears.
 if(/mutlu\s+değil|mutlu\s+degil|iyi\s+değil|iyi\s+degil|iyi\s+hissetmiyorum|iyi\s+hissedemiyorum|keyfim\s+yok|ayrıldım|ayrildim/.test(text))return 'huzunlu';
 if(/sakin\s+değil|sakin\s+degil|huzurlu\s+değil|huzurlu\s+degil/.test(text))return 'kaygili';
 const matches=(Object.keys(signals) as MoodId[]).filter(mood=>signals[mood].some(pattern=>pattern.test(text)));
 if(matches.length===0){
  if(/zor|kötü|kotu|dert|dertli|canım sıkkın|canim sikkin/.test(text))return 'huzunlu';
  if(/güzel|guzel|süper|super|müthiş|muthis|sevindir/.test(text))return 'mutlu';
  return 'sakin';
 }
 // For mixed feelings, the last expressed signal usually carries the user's conclusion.
 let selected=matches[0],last=-1;
 for(const mood of matches){
  for(const pattern of signals[mood]){
   const match=pattern.exec(text);
   if(match&&match.index>=last){selected=mood;last=match.index;}
  }
 }
 return selected;
}
