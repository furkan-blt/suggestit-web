import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getModel,matchHistory,percentile,recommend} from '../lib/engine';
import {buildTasteGraph} from '../lib/graph';
import {boundedText,normalizeIdentifier,parseLetterboxd,ProviderError} from '../lib/providers';

test('serving ranks and scores agree with independently computed Python reference',()=>{
 const model=getModel();const reference=JSON.parse(readFileSync('data/parity.json','utf8'));const actual=recommend(model.demo,reference.scope==='warm-only'?{...model,eligible:model.cfAvailable!}:model);
 assert.deepEqual(actual.map(x=>x.id),reference.topMovieIds);
 // JSON model factors/features are rounded for deployment; ordering is exact, score drift is bounded.
 actual.forEach((x,i)=>assert.ok(Math.abs(x.score-reference.scores[i])<.06));
 const seen=new Set(model.demo.map(([i])=>model.movies[i].id));assert.ok(actual.every(x=>!seen.has(x.id)));
});
test('equal raw scores receive equal percentiles',()=>{assert.deepEqual(percentile([3,1,1,5]),[2/3,1/6,1/6,1]);assert.deepEqual(percentile([2,2,2]),[.5,.5,.5]);});
test('different histories produce different recommendations',()=>{const m=getModel();const a=recommend([[0,5],[1,4]],m);const b=recommend([[50,5],[100,4]],m);assert.notDeepEqual(a.map(x=>x.id),b.map(x=>x.id));});
test('negative-only profile is not misrepresented as personalized',()=>{assert.throws(()=>recommend([[0,1],[1,2]]),/NO_POSITIVE_HISTORY/)});
test('taste graph retains low-rated watches and uses graded rating strength',()=>{
 const model=getModel(),history:[number,number][]=[[0,1],[1,5],[2,3]];
 const graph=buildTasteGraph(history,model,new Set([0,1]));
 assert.equal(graph.watched,3);
 assert.deepEqual(graph.nodes.map(node=>node.rating),[1,5,undefined]);
 assert.deepEqual(new Set(graph.reveal),new Set(history.map(([index])=>index)));
 assert.ok(graph.edges.every(edge=>edge.patterns.length>0));
});
test('strongest film pattern appears first, then the complete watched history',()=>{
 const model=getModel(),graph=buildTasteGraph(model.demo,model,new Set(model.demo.map(([index])=>index)));
 assert.equal(graph.nodes.length,model.demo.length);
 assert.deepEqual(graph.reveal.slice(0,2),[graph.edges[0].source,graph.edges[0].target]);
 assert.ok(graph.edges[0].patterns.some(pattern=>pattern.startsWith('Yönetmen:')));
 assert.equal(graph.reveal.length,model.demo.length);
});
test('uncatalogued watches remain in the full graph as unconnected films',()=>{
 const graph=buildTasteGraph([[0,4]],getModel(),new Set([0]),[{imdbId:'tt9999999',title:'Unknown Film',year:'2024',rating:2}]);
 assert.equal(graph.watched,2);
 assert.ok(graph.nodes.some(node=>node.label==='Unknown Film'&&node.group==='Metadata yok'&&node.rating===2));
 assert.equal(new Set(graph.reveal).size,2);
});
test('specific reasons cite a positively rated, genre-related movie without changing ranking',()=>{
 const model=getModel(),history:[[number,number],[number,number]]=[[0,3],[1,1]];
 const baseline=recommend(history,model,100,new Set());
 const explained=recommend(history,model,100,new Set([0]));
 assert.deepEqual(explained.map(({id,score})=>({id,score})),baseline.map(({id,score})=>({id,score})));
 const specific=explained.filter(film=>film.reason.includes('çünkü'));
 assert.ok(specific.length>0);
 assert.ok(specific.every(film=>film.reason.includes('“Toy Story” filmini beğendin')&&!film.reason.includes('“Jumanji” filmini beğendin')));
 assert.ok(specific.every(film=>film.genres.some(genre=>model.movies[0].genres.includes(genre))));
 assert.ok(baseline.every(film=>!film.reason.includes('çünkü')));
});
test('stable identifiers match and repeated watches do not increase influence',()=>{const m=getModel();const movie=m.movies[0];assert.deepEqual(matchHistory([{tmdbId:movie.tmdbId,rating:4},{imdbId:movie.imdbId,rating:5}]),[[0,4]]);});
test('IMDb supports both legacy and new profile identifiers',()=>{assert.equal(normalizeIdentifier('imdb','https://www.imdb.com/user/p.dkekh4wnj3q7cv3rvvxvzvvyry?ref_=hm_nv_profile'),'p.dkekh4wnj3q7cv3rvvxvzvvyry');assert.equal(normalizeIdentifier('imdb','https://www.imdb.com/user/ur123/'),'ur123');});
test('profile input cannot redirect fetches to arbitrary hosts or paths',()=>{for(const v of ['https://evil.example/popr44','https://letterboxd.com.evil.example/x','../../admin','user?x=y'])assert.throws(()=>normalizeIdentifier('letterboxd',v),ProviderError);assert.equal(normalizeIdentifier('letterboxd','Popr44'),'popr44');});
test('RSS handles one item, missing ratings and invalid upstream data',()=>{const xml='<rss xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org"><channel><item><letterboxd:filmTitle>Toy Story</letterboxd:filmTitle><letterboxd:filmYear>1995</letterboxd:filmYear><tmdb:movieId>862</tmdb:movieId></item></channel></rss>';const p=parseLetterboxd(xml,'test');assert.equal(p.ratings[0].rating,null);assert.equal(p.ratings[0].tmdbId,'862');assert.equal(p.ratings.length,1);assert.throws(()=>parseLetterboxd('<html>blocked</html>','test'),ProviderError);});
test('oversized responses are rejected before parsing',async()=>{await assert.rejects(boundedText(new Response('x'.repeat(3000)),2048),ProviderError);});
