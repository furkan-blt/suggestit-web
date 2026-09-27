import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {escapeFromPointer,moods,quotes} from '../lib/ziuva';
import {classifyMood} from '../lib/ziuvaMood';

test('every mood has varied sourced quotes and a matching expression asset',()=>{
 assert.equal(moods.length,10);
 for(const mood of moods){
  assert.ok(quotes[mood.id].length>=4);
  assert.ok(quotes[mood.id].some(quote=>quote.kind==='Film'));
  for(const quote of quotes[mood.id]){assert.ok(quote.text);assert.ok(quote.source);assert.match(quote.url,/^https:\/\//);}
  assert.ok(existsSync(`public/ziuva/ziuva-${mood.id}.png`));
 }
});
test('free-text mood input maps common expressions and accepts unfamiliar wording',()=>{
 const examples:[string,string][]=[
  ['Bugün çok mutluyum','mutlu'],['İçim buruk ve üzgünüm','huzunlu'],['Yarın için endişeliyim','kaygili'],
  ['Çok yorgunum, enerjim yok','yorgun'],['Çok sinirliyim','ofkeli'],['Aşık oldum','romantik'],
  ['Her şeyin düzeleceğine umutluyum','umutlu'],['Çocukluğumu özledim, eskileri düşünüyorum','nostaljik'],
  ['Yarınki yolculuğum için heyecanlıyım','heyecanli'],['Bugün sakin ve huzurluyum','sakin'],
  ['Mutlu değilim','huzunlu'],['İyi hissedemiyorum','huzunlu'],['Sakin değilim','kaygili'],['Yorgun ama umutluyum','umutlu'],
  ['Moralim bozuk','huzunlu'],['Kafam karışık','kaygili'],
  ['Sevgilimden ayrıldım','huzunlu'],['Yarın sınavım var','kaygili'],
  ['Bugün çok müthiş bir şey yaşadım','mutlu'],['Bugün bir şeyler oldu','sakin'],
  ['Ne diyeceğimi bilemiyorum','kaygili'],
 ];
 for(const [input,expected] of examples)assert.equal(classifyMood(input),expected,input);
 assert.equal(classifyMood('???'),null);
 assert.equal(classifyMood('   '),null);
});
test('mascot escapes a click while staying inside a compact stage',()=>{
 const stage={width:340,height:380},mascot={width:160,height:215};
 for(const position of [{x:0,y:0},{x:78,y:62},{x:-78,y:-62}]){
  const pointer={x:stage.width/2+position.x-24,y:stage.height/2+position.y};
  const next=escapeFromPointer(stage,mascot,position,pointer,90);
  assert.ok(Math.abs(next.x)<=78&&Math.abs(next.y)<=70.5);
  assert.ok(Math.hypot(next.x-position.x,next.y-position.y)>12);
  assert.ok(Math.hypot(stage.width/2+next.x-pointer.x,stage.height/2+next.y-pointer.y)>Math.hypot(stage.width/2+position.x-pointer.x,stage.height/2+position.y-pointer.y));
 }
});
