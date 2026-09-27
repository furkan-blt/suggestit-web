import {findTmdbMovie,getTmdbMovie} from '../lib/tmdb';
async function main(){
 const result=await findTmdbMovie('tt0114709');
 if(result.movie_results.length!==1)throw new Error('IMDb–TMDB eşleşmesi doğrulanamadı.');
 const film=await getTmdbMovie(result.movie_results[0].id);
 if(film.imdb_id!=='tt0114709'||!film.title||!Array.isArray(film.genres))throw new Error('Film ayrıntısı doğrulanamadı.');
 console.log(JSON.stringify({ok:true,imdbId:film.imdb_id,tmdbId:film.id,title:film.title,genres:film.genres.length,cast:film.credits.cast.length,keywords:film.keywords.keywords.length,note:'Bağlantı testi; öneri kalitesi testi değildir.'},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'TMDB testi başarısız.');process.exitCode=1;});
