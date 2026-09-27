import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseImdbCsv} from '../lib/imdb-csv';
import {getModel,matchHistory,recommend} from '../lib/engine';
test('personal rating, quoted commas and BOM import correctly',()=>{
 const p=parseImdbCsv('\ufeffConst,Your Rating,Title,IMDb Rating,Title Type\r\ntt0114709,8,"Toy, Story",9.9,movie\r\n');
 assert.deepEqual(p.ratings,[{imdbId:'tt0114709',rating:4,title:'Toy, Story'}]);
 const h=matchHistory(p.ratings);assert.equal(h.length,1);const films=recommend(h);assert.ok(films.length);assert.ok(films.every(x=>x.imdbId!=='tt0114709'));
});
test('aggregate IMDb Rating is never mistaken for personal ratings',()=>{assert.throws(()=>parseImdbCsv('Const,IMDb Rating\ntt0114709,8'),/Your Rating/);});
test('latest duplicate rating wins regardless of row order; series and invalid ratings excluded',()=>{
 const p=parseImdbCsv('Const,Your Rating,Date Rated,Title Type\ntt0114709,10,2025-01-01,movie\ntt0114709,2,2024-01-01,movie\ntt0113497,8,2024-01-01,tvSeries\ntt0113228,99,2024-01-01,movie');
 assert.deepEqual(p.ratings,[{imdbId:'tt0114709',rating:5}]);assert.equal(p.warnings.length,4);
});
test('malformed, empty and duplicate-column files fail explicitly',()=>{
 for(const csv of ['', 'Const,Your Rating\n', 'Const,Your Rating,Your Rating\ntt0114709,8,4', 'Const,Your Rating\n"unfinished,8'])assert.throws(()=>parseImdbCsv(csv));
});
test('all-negative CSV is parsed but does not produce invented personal recommendations',()=>{
 const p=parseImdbCsv('Const,Your Rating\ntt0114709,1');assert.throws(()=>recommend(matchHistory(p.ratings,getModel())),/NO_POSITIVE_HISTORY/);
});
