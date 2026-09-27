import {readFileSync,writeFileSync} from 'node:fs';

type Entry={imdbId:string;director?:string[];cast?:string[];keywords?:string[]};
const catalog: {entries:Entry[]}=JSON.parse(readFileSync('data/catalog-extra.json','utf8'));
const metadata=Object.fromEntries(catalog.entries.map(entry=>[entry.imdbId,{
 director:entry.director?.filter(Boolean)??[],cast:entry.cast?.filter(Boolean)??[],keywords:entry.keywords?.filter(Boolean)??[]
}]));
writeFileSync('data/graph-meta.json',JSON.stringify(metadata));
process.stdout.write(`Graph metadata: ${catalog.entries.length} films\n`);
