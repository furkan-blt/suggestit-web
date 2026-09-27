# SuggestIT

Türkçe, mobil uyumlu film öneri prototipi. Next.js üzerinde çalışır. Sunum katmanı gerçek öneri motoruna bağlıdır; rastgele veya kullanıcı adından türetilmiş sahte sonuç üretmez.

**Canlı site:** [suggestit-two.vercel.app](https://suggestit-two.vercel.app/) · [Ziuva](https://suggestit-two.vercel.app/ziuva)

## Hızlı başlangıç

Node.js 20.9 veya üzeri gerekir. Depoyu klonladıktan sonra:

```sh
npm ci
npm run dev
```

Arayüz `http://127.0.0.1:3000` adresinde açılır. Örnek MovieLens profili ve Ziuva için API anahtarı gerekmez. Letterboxd profil eşleştirmesi ve TMDB verilerini yenilemek için `.env.example` dosyasını `.env.local` olarak kopyalayıp sunucu tarafı TMDB anahtarını ekleyin. `.env.local` Git'e alınmaz.

```sh
npm run typecheck
npm test
npm run build
```

Ana uygulama `app/`, öneri motoru `lib/`, model ve metadata `data/`, eğitim ve değerlendirme kodu `training/`, otomatik testler `tests/` altındadır. Film grafiği metadata'sı hazır gelir; yeniden üretmek için lisanslı katalog girdilerini `data/catalog-extra.json` konumuna koyup `npm run graph:metadata` çalıştırın.

## Çalışan özellikler ve sınırlar

- Letterboxd kullanıcı adı veya profil bağlantısı → herkese açık RSS → TMDB kimliğiyle MovieLens eşleştirmesi → kişisel öneriler. RSS tam geçmiş değildir. Sağlayıcı istekleri engellerse uygulama açık hata döndürür.
- IMDb için **Ratings CSV yüklemesi çalışır**. IMDb Your ratings > Export dosyası kullanılır; `Const` ve `Your Rating` zorunludur. En fazla 2 MB / 20.000 kayıt kabul edilir. Kişisel puan ikiye bölünür; IMDb genel puanı kullanılmaz. Aynı film tekrar ederse varsa en yeni Date Rated seçilir. Dizi/bölüm ve geçersiz satırlar sayısı belirtilerek atlanır. Dosya diske yazılmaz veya TMDB'ye gönderilmez. Puanlanmamış izlemeler bilinmez. Kullanıcı adına dayalı eski IMDb bağlayıcısı yalnızca özel sağlayıcı yapılandırılırsa kullanılabilir; arayüzde CSV esas alınır.
- Hesaptan bağımsız, açıkça etiketlenmiş MovieLens örnek profili.
- Arama tamamlandığında önerilerden önce yalnızca kullanıcının izlediği filmlerden oluşan ağ gösterilir. En güçlü metadata bağı ilk görünür; ardından erişilebilen geçmişin tamamı kademeli açılır. Tür, yönetmen, oyuncu ve anahtar kelime ortaklıkları bağları; renkler tür odaklı ilgi kümelerini gösterir. Puan yakınlığı bağ gücünü etkiler, yüksek puanlı filmler daha parlak görünür, düşük puanlılar da ağda kalır. Katalogda eşleşmeyen geçmiş kayıtları metadata olmadan gösterilir. Bu görselleştirme öneri sıralamasını değiştirmez.
- Ana sayfadaki Ziuva bağlantısı `/ziuva` sayfasını açar. Kullanıcı ruh hâlini serbest metinle anlatır; yerel sınıflandırıcı bunu 10 görsel ruh hâlinden birine eşler. Belirgin duygu sinyali olmayan metinler sakin sınıfına alınır; yalnızca boş veya sözcük içermeyen girişler açıklama ister. Giriş onaylanınca sayfa doğrudan Ziuva alanına kayar. Maskot beklerken hafifçe hareket eder; üç tıklamada imleçten uzaklaşıp arkasında toz bırakır. Son tıklamadan sonra aynı oyun alanında seçilen yüz ifadesi ve o ruh hâlinin kaynak bağlantılı söz havuzundan bir alıntı görünür. Hareket azaltma tercihi etkinse hareket ve toz animasyonu uygulanmaz.
- 9.742 MovieLens filmi ve 100.836 puanla eğitilmiş collaborative katmanına ek olarak TMDB’den 2019–2026 arası 160 güncel film eklendi. `imdb_top_1000.csv` içindeki 793 film eşleşti ve konu, yönetmen, oyuncu ve anahtar kelime özellikleri içerik katmanına girdi. 2019 sonrası filmlerin ortak puan verisi olmadığı için MF yerine içerik benzerliğiyle sıralanır.
- Sunucuda 5 dakika / en fazla 100 profil kapasiteli geçici bellek önbelleği; profil verileri diske kaydedilmez. Bu süreç bazlıdır, dağıtık cache veya rate limit değildir.

## Öneri mimarisi

1. Puanlar 0.5–5 ölçeğinde birleştirilir; IMDb sağlayıcısı 1–10 puanları ikiye bölmelidir. Kimlikler IMDb/TMDB üzerinden eşleştirilir. Başlık+yıl eşleşmesi yalnızca tekilse kullanılır.
2. **MF:** Pozitif tercih matrisi `max(rating - 2.5, 0)` üzerinde 32 boyutlu truncated SVD; yeni kullanıcının geçmişi sabit film faktörlerine yansıtılır. Bu bir örtük tercih yaklaşımıdır, eksik puan tahmini için explicit-rating SVD değildir.
3. **İçerik benzerliği:** L2 normalize tür, TF-IDF konu özeti, yönetmen, oyuncu ve anahtar kelime özellikleri ile ağırlıklı kullanıcı profili arasındaki benzerlik.
4. **Personalized PageRank:** Eğitim kullanıcıları–filmler iki parçalı grafiğinde iki adımlı yürüyüş; %15 yeniden başlatma, en fazla 30 iterasyon. Soğuk başlangıç düğümlerinin kayıp olasılık kütlesi başlangıç dağılımına döner.
5. İzlenmiş filmler çıkarıldıktan sonra her sinyal eşit değerlere eşit yüzdelik sıra verir. `score = w_mf * percentile(mf) + w_cosine * percentile(cosine) + w_ppr * percentile(ppr)`.
6. Puanlanan bir film tekrar izlendiğinde etkisi çoğaltılmaz. RSS puanı yoksa zayıf pozitif sinyal (3/5) kabul edilir. Düşük puanlar pozitif tohuma katılmaz, izlenenler listesinden yine elenir. Bu basitleştirme gerçek kullanıcı verisiyle ayrıca değerlendirilmeli.

Yüzdelik skor beğenme olasılığı değildir. Tür veya popülerlik çeşitlendirmesi değerlendirme dışı gizli bir son adım olarak eklenmedi; çevrimdışı ve canlı sıralama aynı formülü kullanır. Üç bileşen desteklenir, ancak seçilmiş ağırlıklar bir bileşeni sıfırlayabilir.

## Ağırlık deneyi

```sh
python -m venv .venv
# Windows
.venv/Scripts/python -m pip install -r training/requirements.txt
.venv/Scripts/python training/train.py
```

Eğitim `https://files.grouplens.org/datasets/movielens/ml-latest-small.zip` adresinden veriyi indirir, SHA-256 değerini rapora yazar. Windows sertifika deposuyla indirmek gerekirse aynı HTTPS dosyasını `Invoke-WebRequest` ile `data/raw/ml-latest-small.zip` konumuna kaydedebilirsin; sertifika doğrulamasını kapatma.

`data/report.json` tüm 231 kombinasyonu, 3 doğrulama aralığını, ayrılmış test dönemini, bileşen karşılaştırmalarını ve bootstrap güven aralığını içerir. Küresel zaman eşikleri diğer kullanıcıların gelecekteki puanlarının eğitime sızmasını önler. Eğitim/aday uygunluğu her pencere için yeniden hesaplanır. İlk %55/%65/%75 ile eğitim, sonraki %10 ile doğrulama yapılır; eşit pencere ortalamasıyla seçim yapılır. Son %15 yalnızca nihai testtir. Test ölçümünden sonra sunum modeli tüm veride tekrar eğitilir. Kişisel CSV raporları `data/private/` altında tutulur ve dağıtıma girmez.

Doğrulama pencerelerinde 19, 21 ve 12 kullanıcı-dönemi, testte 29 kullanıcı değerlendirilebildi. Bir kullanıcının en az 5 pozitif eğitim kaydı ve katalogda uygun en az bir gelecek beğenisi olması gerekir. Yeni kullanıcı/yeni film başarısı bu deneyle ölçülmez. Bu veri ile çok sayıda model parametresi aramak aşırı uyuma yol açabilir; boyut, eşik ve PageRank parametreleri arama öncesi sabit tutuldu.

Doğrulama seçimi **MF 1.00 / Cosine 0.00 / PPR 0.00** oldu. Test NDCG@10: MF 0.13156, PPR 0.13508, popülerlik 0.10068. Testte PPR daha iyi görünse de test verisi üzerinden ağırlık yeniden seçilmedi. Kullanıcı kararıyla üretim skoru kontrollü bir karışım kullanıyor: **MF 5 parça / Cosine 1 parça / PPR 1 parça**, yani normalize ağırlıklar **5/7, 1/7, 1/7**. Böylece Cosine ve PPR katkısı korunuyor, fakat ana sinyal MF olarak kalıyor. Popülerliğe farkın %95 bootstrap aralığı **[-0.05138, 0.10025]**; istatistiksel üstünlük kanıtlanmadı. "Optimum" yalnızca aranan gridin doğrulama sonucudur.

## IMDb / tam geçmiş için sağlayıcı sözleşmesi

`.env.example` alanlarını sunucuda ayarla. Mevcut bağlayıcı bir hazır ticari API entegrasyonu değildir; aşağıdaki sözleşmeyi uygulayan güvenilir servise yönlendirme noktasıdır.

Sunucu `PROFILE_ADAPTER_URL?platform=imdb&identifier=p.…` adresine `Authorization: Bearer ...` ile GET gönderir. Aynı bağlayıcı Letterboxd tam geçmişi için de kullanılabilir. Yanıt:

```json
{"name":"kullanıcı","complete":true,"ratings":[{"imdbId":"tt0114709","rating":4.5},{"tmdbId":"862","rating":null}]}
```

`rating` 0.5–5 veya `null`; `complete` gerçekten tüm geçmiş okunmuşsa true olmalıdır. Arama birden çok hesap bulursa bağlayıcı yanlış hesabı seçmemeli, belirsizlik hatası vermelidir. Giriş kontrollüdür; kullanıcı girdisi dış istek hostunu belirlemez. Yanıtlar boyut ve süre sınırıyla okunur. Sunucu anahtarları istemciye aktarılmaz.

## Vercel yayını

Üretim sitesi: https://suggestit-two.vercel.app/ — Vercel projesi `deneme11/suggestit`. `TMDB_API_KEY` yalnızca Vercel Production ortamında gizli sunucu değişkeni olarak ayarlanmıştır.

```sh
npx vercel login
npx vercel --prod
```

Framework: Next.js; Vercel proje kökü bu deponun kök dizinidir. Model dosyası route tracing ayarıyla sunucu paketine alınır. Python eğitimi Vercel istekleri içinde çalıştırılmaz. Araştırma modeli yaklaşık 6 MB'dır; ayrı veritabanı bu prototip için gerekli değildir. Üretimde güncel lisanslı katalog, gerçek profil erişimi, dağıtık hız sınırlama ve cache eklenmelidir.

Vercel yayını şu anda CLI ile yapılır; GitHub deposu otomatik dağıtım için bağlı değildir. `.vercelignore` özel yerel dosyaları, test girdilerini ve ham profilleri dağıtım dışında tutar.

## Veri kaynağı

### TMDB bağlantısı

Proje kökündeki `.env.local` dosyasında **birini** doldur:

```dotenv
TMDB_READ_ACCESS_TOKEN=
TMDB_API_KEY=
```

İlk satır TMDB Settings > API > **API Read Access Token**, ikinci satır **API Key (v3 auth)** içindir. Token varsa öncelikle Bearer başlığıyla kullanılır. Bu değişkenlere `NEXT_PUBLIC_` öneki ekleme. `.env.local` Git ve Vercel paketinden dışlanır; anahtarı sohbet veya kaynak koduna koyma.

```sh
npm run tmdb:check
```

Bu komut `.env.local` dosyasını yükler; IMDb film kimliği `tt0114709` ile TMDB eşleştirmesini, film ayrıntısını, tür/oyuncu/anahtar kelime alanlarını kontrol eder. Anahtar veya istek URL'sini yazdırmaz. TMDB içerik özellikleri güncel film kataloğuna eklenmiştir; 2019 sonrası filmler için ortak MovieLens puanı bulunmadığından yalnız içerik benzerliği kullanılır. Bu katalogla gerçek kullanıcı öneri kalitesi ayrıca ölçülmelidir.

[MovieLens / GroupLens](https://grouplens.org/datasets/movielens/latest/). F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets: History and Context. ACM TiiS 5(4), Article 19. DOI: 10.1145/2827872.

This product uses the TMDB API but is not endorsed or certified by TMDB. [TMDB API atıf koşulları](https://developer.themoviedb.org/docs/faq).

Veri ve türetilmiş model araştırma lisansına tabidir; ticari/gelir getiren kullanım için GroupLens izni gerekir. Tam lisans `data/MOVIELENS-LICENSE.txt` içindedir. Özel profil veya API anahtarı repoya eklenmemelidir.

## Lisans ve katkı notu

Bu depo için genel bir yazılım lisansı henüz tanımlanmadı. MovieLens verisi ve ondan türetilen model, depodaki `data/MOVIELENS-LICENSE.txt` koşullarına tabidir. Üçüncü taraf film afişleri depoya dahil değildir. Alıntılar ilgili hak sahiplerine aittir; bu depo onların yeniden kullanım hakkını vermez. Güvenlik açığı veya veri sızıntısı bulursanız bunu herkese açık issue içinde gizli bilgileri paylaşmadan bildirin.
