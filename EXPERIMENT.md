# Ağırlık deneyi — 24 Eylül 2026

**231 kombinasyon × 3 zaman penceresi = 693 kombinasyon–pencere değerlendirmesi.** Aynı veride rastgele tekrarlar yerine zaman sıralı ayrım kullanıldı. Doğrulama ortalamasında seçilen ağırlık MF **1.00**, Cosine **0.00**, Personalized PageRank **0.00** oldu. Üretimde kullanıcı kararıyla MF **5**, Cosine **1**, PPR **1** parça kullanılıyor: normalize ağırlıklar **5/7, 1/7, 1/7**.

| Yöntem | Test NDCG@10 | Recall@10 | Precision@10 |
|---|---:|---:|---:|
| Doğrulamada seçilen karışım (yalnız MF) | 0.13156 | 0.04513 | 0.11379 |
| Yalnız PPR | 0.13508 | 0.05627 | 0.11379 |
| Yalnız Cosine | 0.02585 | 0.00324 | 0.02414 |
| Popülerlik | 0.10068 | 0.04451 | 0.08621 |

Testte PPR'nin daha yüksek olması seçim kuralını değiştirmedi: test sonuçlarına bakıp ağırlığı değiştirmek bu test kümesini doğrulama kümesine dönüştürürdü.

## Ne söylenebilir?

- Bu model ve grid için bir başlangıç ağırlığı bulundu. Evrensel optimum bulunmadı.
- Doğrulama pencereleri 19, 21, 12 kullanıcı-dönemi; final test 29 kullanıcı içeriyor. Küçük örneklem.
- Popülerliğe göre NDCG farkının %95 bootstrap aralığı **−0.05138 ile +0.10025**. Aralık sıfırı içeriyor; üstünlük kanıtlanmadı.
- Testte bu kullanıcıların 1.519 olumlu gelecek puanının 937'si aday uygunluk filtresini geçti. Rapor yalnızca mevcut kullanıcı/mevcut film koşulunu ölçüyor.
- MovieLens 2018 geliştirme verisi, bugünkü Letterboxd veya IMDb kitlesinin temsilcisi olarak kabul edilemez.

## Uygulama doğrulaması

- 26 otomatik test: Python–TypeScript sıralama uyumu, izlenenleri eleme, farklı geçmişlere farklı öneriler, düşük puanlı profil, eşit skorlar, kimlik eşleştirme, profil URL kontrolü, RSS ayrıştırma, yanıt boyutu, IMDb CSV ve Ziuva akışı.
- Next.js üretim derlemesi ve TypeScript kontrolü başarılı.
- Canlı Letterboxd denemesinde verilen profilden 27 RSS kaydı okundu, 19 film eşleşti, 12 öneri üretildi. Profil verisi kaynak koduna veya model dosyasına eklenmedi.
- IMDb için verilen yeni biçimde profil URL'si kabul ediliyor; kaynağın otomatik erişime içerik döndürmemesi nedeniyle canlı IMDb puanları okunamadı. Sağlayıcı bağlantısı kurulmadan IMDb önerisi yok.
- Canlı Vercel sürümünde ana sayfa, örnek MovieLens profili, film grafiği ve Ziuva akışı tarayıcıda doğrulandı.

Ham deney sonuçları `data/report.json`; tekrar üretim kodu `training/train.py`; kurulum ve sınırlar `README.md` içinde.
