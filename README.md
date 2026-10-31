# Open Crow

Sohbet tabanlı masaüstü asistanı. Kendi API anahtarınla çalışır; hesap, giriş ya da sunucu gerektirmez.

## Özellikler

- Sade sohbet arayüzü: sol kenarda oturum listesi, ortada yanıt akışı, altta yazı alanı
- Yanıtlar akarak gelir, kod blokları kopyalama düğmesiyle gösterilir
- OpenAI uyumlu herhangi bir sağlayıcıyla çalışır (adres + anahtar)
- Oturumlar ve anahtar yalnızca bu bilgisayarda saklanır

## Kurulum

```bash
npm install
npm run dev        # geliştirme
npm test           # testler
npm run dist:win   # Windows kurulum dosyası
```

## Sağlayıcı ayarı

Uygulamayı açtıktan sonra Ayarlar bölümünden bir API adresi (örneğin `https://api.openai.com/v1`) ve anahtarını gir. Model listesi bu adresten çekilir.

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE).
