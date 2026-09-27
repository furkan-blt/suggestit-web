/** Graded utility on IMDb's 1–10 scale. Missing ratings are not dislikes. */
export function ratingGain(rating10:number):number {
 if(!Number.isFinite(rating10)||rating10<1||rating10>10)throw new Error('Rating must be 1–10');
 return rating10>=6?(rating10-5)/5:0;
}
export function gradedMetrics(rankedIds:string[],heldOut:Map<string,number>,eligibleIds:Set<string>,k=10){
 const positive=new Map([...heldOut].filter(([,r])=>r>=6).map(([id,r])=>[id,ratingGain(r)]));
 const eligible=[...positive].filter(([id])=>eligibleIds.has(id));
 const ideal=eligible.map(([,g])=>g).sort((a,b)=>b-a).slice(0,k).reduce((s,g,i)=>s+g/Math.log2(i+2),0);
 const top=rankedIds.slice(0,k);const hits=top.filter(id=>positive.has(id)).length;
 const dcg=top.reduce((s,id,i)=>s+(positive.get(id)||0)/Math.log2(i+2),0);
 return {ndcg10:ideal?dcg/ideal:0,precision10:hits/k,recall10Eligible:eligible.length?hits/eligible.length:0,recall10AllPositives:positive.size?hits/positive.size:0,hits};
}
