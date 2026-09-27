"""Reproducible offline experiment. Never optimizes on the final test period."""
import os
os.environ['OPENBLAS_NUM_THREADS'] = '2'
os.environ['OMP_NUM_THREADS'] = '2'
import csv, io, json, hashlib, zipfile, urllib.request, time
from pathlib import Path
import numpy as np
from scipy.sparse import csr_matrix, diags, hstack
from scipy.stats import rankdata
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_extraction import DictVectorizer
from threadpoolctl import threadpool_limits
threadpool_limits(limits=2)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'data'
RAW = DATA/'raw'
RAW.mkdir(parents=True, exist_ok=True)
archive = RAW/'ml-latest-small.zip'
if not archive.exists():
    urllib.request.urlretrieve('https://files.grouplens.org/datasets/movielens/ml-latest-small.zip', archive)
z = zipfile.ZipFile(archive)
def rows(name):
    return list(csv.DictReader(io.StringIO(z.read('ml-latest-small/'+name).decode('utf-8'))))
movies = rows('movies.csv'); links = {int(x['movieId']):x for x in rows('links.csv')}
ids = {int(m['movieId']):i for i,m in enumerate(movies)}
ratings = np.array([[int(x['userId'])-1, ids[int(x['movieId'])],float(x['rating']),int(x['timestamp'])] for x in rows('ratings.csv')])
extra=json.loads((DATA/'catalog-extra.json').read_text(encoding='utf-8')) if (DATA/'catalog-extra.json').exists() else {'report':{},'entries':[]}
metadata={m['imdbId']:m for m in extra['entries']}
known={'tt'+v['imdbId'].zfill(7) for v in links.values()}
genre_alias={'Science Fiction':'Sci-Fi','Family':'Children'}
for j,m in enumerate(extra['entries']):
    if m['imdbId'] in known:continue
    mid=1000000+j
    movies.append({'movieId':str(mid),'title':m['title']+' ('+m['year']+')','genres':'|'.join(genre_alias.get(g,g) for g in m['genres'])})
    links[mid]={'imdbId':m['imdbId'][2:],'tmdbId':m['tmdbId']}
    known.add(m['imdbId'])
N = len(movies); U = int(ratings[:,0].max())+1
genres = sorted({g for m in movies for g in m['genres'].split('|') if g!='(no genres listed)'})
content = np.array([[int(g in m['genres'].split('|')) for g in genres] for m in movies],dtype=np.float64)
# Genres are static metadata; no future tags or interaction counts are used.
genre_content = normalize(content)
documents=[];attributes=[];enriched=[]
for movie in movies:
    meta=metadata.get('tt'+links[int(movie['movieId'])]['imdbId'].zfill(7),{})
    documents.append(meta.get('overview',''))
    features={'genre:'+g:1.0 for g in movie['genres'].split('|') if g!='(no genres listed)'}
    for name in meta.get('director',[]):features['director:'+name.casefold()]=1.5
    for name in meta.get('cast',[]):features['actor:'+name.casefold()]=1.0
    for name in meta.get('keywords',[]):features['keyword:'+name.casefold()]=1.0
    attributes.append(features);enriched.append(bool(meta))
structured=normalize(DictVectorizer().fit_transform(attributes))
if any(documents):
    tfidf=TfidfVectorizer(stop_words='english',max_features=3000,min_df=2,sublinear_tf=True).fit_transform(documents)
    content=normalize(hstack([structured,tfidf],format='csr'))
else:content=structured.tocsr()
weights = np.array([[a/20,b/20,(20-a-b)/20] for a in range(21) for b in range(21-a)])

def fit(train):
    values = np.maximum(train[:,2]-2.5,0)
    a = csr_matrix((values,(train[:,0].astype(int),train[:,1].astype(int))),shape=(U,N))
    a.eliminate_zeros()
    svd = TruncatedSVD(n_components=32,n_iter=7,random_state=42).fit(a)
    factors = svd.components_.T
    counts = np.bincount(train[:,1].astype(int),minlength=N)
    ud = np.asarray(a.sum(axis=1)).ravel(); it = np.asarray(a.sum(axis=0)).ravel()
    to_items = diags(1/np.maximum(ud,1e-12))@a
    to_users = diags(1/np.maximum(it,1e-12))@a.T
    return dict(factors=factors, a=a, ui=to_items, iu=to_users, eligible=counts>=5, popularity=counts)

def signals(model,history):
    h = np.zeros(N)
    for _,i,r,_ in history: h[int(i)] = max(r-2.5,0)
    mf = model['factors']@(h@model['factors'])
    taste = np.asarray(h@content).ravel(); norm = np.linalg.norm(taste)
    cosine = content@(taste/max(norm,1e-12))
    seed = h/max(h.sum(),1e-12); p = seed.copy()
    for _ in range(30):
        walk = np.asarray((p@model['iu'])@model['ui']).ravel()
        p2 = .15*seed+.85*(walk+max(0,1-walk.sum())*seed)
        if np.abs(p2-p).sum()<1e-8: p=p2; break
        p=p2
    eligible = model['eligible'].copy(); eligible[history[:,1].astype(int)] = False
    candidates = np.flatnonzero(eligible)
    raw = np.array([mf[candidates],cosine[candidates],p[candidates]])
    scores = np.array([(rankdata(s,method='average')-1)/max(len(s)-1,1) for s in raw])
    return candidates,scores

def cases(model,train,future,seed,cap=120):
    cases=[]; rng=np.random.default_rng(seed)
    for u in rng.permutation(U):
        h=train[train[:,0]==u]; t=future[(future[:,0]==u)&(future[:,2]>=3)]
        if (h[:,2]>=3).sum()<5 or not len(t): continue
        candidates,scores=signals(model,h)
        gains=np.zeros(N)
        gains[t[:,1].astype(int)]=(t[:,2]-2.5)/2.5
        relevant = gains[candidates]
        if not relevant.any(): continue
        cases.append((int(u),candidates,scores,relevant,len(h),len(t)))
        if len(cases)>=cap:break
    return cases

discount=1/np.log2(np.arange(2,12))
def metrics(scores,relevant):
    # Stable catalog-index tie breaking, also implemented in serving.
    order=np.lexsort((np.arange(len(scores)),-scores))[:10]
    gains=relevant[order];hits=np.count_nonzero(gains)
    ideal=np.sort(relevant)[::-1][:10]
    return np.array([(gains*discount[:len(gains)]).sum()/(ideal*discount[:len(ideal)]).sum(), hits/np.count_nonzero(relevant),hits/10])

def search(cases):
    sums=np.zeros((len(weights),3))
    for _,c,s,r,_,_ in cases:
        combined=weights@s
        # Argpartition reduces work; metrics then orders the chosen top ten with tie break.
        for j in range(len(weights)):sums[j]+=metrics(combined[j],r)
    return sums/max(len(cases),1)

def describe(cases,w,model):
    out={}; per={}
    for name,weight in [('hybrid',w),('mf',[1,0,0]),('cosine',[0,1,0]),('ppr',[0,0,1]),('popularity',None)]:
        v=np.array([metrics(model['popularity'][c] if weight is None else np.asarray(weight)@s,r) for _,c,s,r,_,_ in cases])
        out[name]=dict(zip(['ndcg10','recall10','precision10'],v.mean(axis=0).tolist()))
        per[name]=v[:,0]
    return out,per

started=time.time(); val_results=[]; fold_info=[]
for fold,(start,end) in enumerate([(0.55,0.65),(0.65,0.75),(0.75,0.85)]):
    cut1,cut2=np.quantile(ratings[:,3],[start,end]); train=ratings[ratings[:,3]<cut1]; future=ratings[(ratings[:,3]>=cut1)&(ratings[:,3]<cut2)]
    print(f'Validation fold {fold+1}: fitting on {len(train)} ratings',flush=True)
    model=fit(train); batch=cases(model,train,future,42+fold)
    if not batch:raise RuntimeError('No eligible evaluation users')
    result=search(batch);val_results.append(result)
    fold_info.append({'train_before':int(cut1),'validate_before':int(cut2),'users':len(batch),'train_ratings':len(train),'best_weights':weights[int(result[:,0].argmax())].tolist()})
    print(f'Fold {fold+1} complete: {len(batch)} users, {len(weights)} weight combinations',flush=True)
averages=np.mean(val_results,axis=0); best=int(averages[:,0].argmax()); selected=weights[best]; deployment_weights=np.array([5/7,1/7,1/7])
cut=np.quantile(ratings[:,3],.85); train=ratings[ratings[:,3]<cut]; future=ratings[ratings[:,3]>=cut]
model=fit(train); test=cases(model,train,future,123,cap=610)
measures,per=describe(test,selected,model)
rng=np.random.default_rng(2026); delta=per['hybrid']-per['popularity']; bootstrap=np.array([rng.choice(delta,len(delta),replace=True).mean() for _ in range(2000)])
report={'dataset':'MovieLens latest-small (2018 snapshot) + TMDB catalog extension','dataset_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'components':['mf','cosine','ppr'],'weights':selected.tolist(),'deployment_weights':deployment_weights.tolist(),'search_combinations':len(weights),'validation_folds':fold_info,'validation_ndcg10':float(averages[best,0]),'test_users':len(test),'test_train_before':int(cut),'test_metrics':measures,'hybrid_minus_popularity_ndcg10_ci95':np.quantile(bootstrap,[.025,.975]).tolist(),'test_relevant_eligible':sum(int(x[3].sum()) for x in test),'test_relevant_total_for_evaluated_users':sum(x[5] for x in test),'protocol':'Global temporal expanding windows. Equal mean across 3 validation folds. Final 15% of timestamps untouched until selection. All unseen items with >=5 training ratings are ranked; graded relevance >=3/5 with gain=(rating-2.5)/2.5; at least 5 positive training ratings per evaluated user. Test is warm-user/warm-item only. SVD dimensions=32, restart=.15, 30 PPR steps fixed before search. Scores use per-query percentile ranks. No diversity reranking.','limitations':['Development benchmark, not evidence of Letterboxd/IMDb performance.','MovieLens collaborative training ends in 2018; 2019+ catalog items are cold-start content candidates.','Warm-item evaluation excludes titles with fewer than five training ratings.','Weights are best only on this grid and these folds, not a global optimum.','MovieLens research license; commercial use requires permission.'],'experiments':[{'weights':w.tolist(),'mean_validation_ndcg10':float(v[0]),'mean_validation_recall10':float(v[1])} for w,v in zip(weights,averages)],'elapsed_seconds':round(time.time()-started,2)}
report['protocol']=report['protocol'].replace('positive relevance >=4/5','graded relevance >=3/5: gain=(rating-2.5)/2.5')
report['test_relevant_eligible']=sum(int(np.count_nonzero(x[3])) for x in test)
report['catalog_extension']=extra['report']
report['limitations']=[x for x in report['limitations'] if x!='Catalog ends in 2018; no recent releases.']+['Collaborative training ends in 2018. Expanded cold-start items use content only; their ranking quality is not measured by this warm-item benchmark.','Current metadata is used retrospectively; this is not a prospective historical simulation.']
if (DATA/'report.json').exists(): (RAW/'report-before-v2.json').write_bytes((DATA/'report.json').read_bytes())
(DATA/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Selected weights',selected,'test',measures,flush=True)
# Refit after evaluation for serving; this model is never used for the held-out metrics.
model=fit(ratings)
catalog=[]
for i,m in enumerate(movies):
    link=links[int(m['movieId'])]
    catalog.append({'id':int(m['movieId']),'title':m['title'],'genres':[g for g in m['genres'].split('|') if g!='(no genres listed)'],'imdbId':'tt'+link['imdbId'].zfill(7),'tmdbId':link['tmdbId']})
users=[]
for u in range(U):
    row=model['a'].getrow(u); users.append([[int(i),round(float(v),6)] for i,v in zip(row.indices,row.data)])
demo=[[int(i),float(r)] for _,i,r,_ in ratings[ratings[:,0]==413]]
feature_rows=[]
for i in range(N):
    row=content.getrow(i);feature_rows.append([[int(j),round(float(v),7)] for j,v in zip(row.indices,row.data)])
artifact={'version':2,'movies':catalog,'genreNames':genres,'content':np.round(genre_content,7).tolist(),'features':feature_rows,'featureCount':content.shape[1],'enriched':enriched,'cfAvailable':model['eligible'].tolist(),'factors':np.round(model['factors'],7).tolist(),'users':users,'eligible':[bool(ok or rich) for ok,rich in zip(model['eligible'],enriched)],'weights':deployment_weights.tolist(),'validationWeights':selected.tolist(),'demo':demo,'source':'https://grouplens.org/datasets/movielens/latest/','catalogReport':extra['report'],'ratingPolicy':{'positiveMinimum10':6,'gain':'(rating10-5)/5; 6=.2,7=.4,8=.6,9=.8,10=1'},'deploymentRule':'MF=5 parts, Cosine=1 part, PPR=1 part; normalized by total 7.'}
if (DATA/'model.json').exists(): (RAW/'model-before-v2.json').write_bytes((DATA/'model.json').read_bytes())
(DATA/'model.json').write_text(json.dumps(artifact,separators=(',',':')),encoding='utf-8')
(DATA/'MOVIELENS-LICENSE.txt').write_bytes(z.read('ml-latest-small/README.txt'))
# Serving parity fixture, generated by the reference implementation.
h=ratings[ratings[:,0]==413];c,s=signals(model,h);rank=np.lexsort((c,-(deployment_weights@s)))[:12]
(DATA/'parity.json').write_text(json.dumps({'scope':'warm-only','topMovieIds':[catalog[int(c[x])]['id'] for x in rank],'scores':[(selected@s)[x] for x in rank]}),encoding='utf-8')
print(f'Done: {N} films, {len(ratings)} ratings. Artifact {(DATA/"model.json").stat().st_size/1e6:.1f} MB',flush=True)
