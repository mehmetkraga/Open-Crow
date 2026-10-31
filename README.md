# Open Crow

AI destekli masaüstü kodlama asistanı. Kendi API anahtarınla çalışır; hesap, giriş ya da sunucu gerektirmez.

## Özellikler

- Monaco tabanlı kod editörü, dosya ağacı, terminal
- Sohbet tabanlı ajan: dosya okuma/yazma, arama, MCP araçları, alt ajanlar
- OpenAI uyumlu sağlayıcılar ve Anthropic ile çalışır
- Anahtar yalnızca bu bilgisayarda saklanır

## Kurulum

```bash
npm install
npm run dev        # geliştirme
npm test           # testler
npm run dist:win   # Windows kurulum dosyası
```

## Sağlayıcı ayarı

Uygulamayı açtıktan sonra Ayarlar > API bölümünden bir API adresi (örneğin `https://api.openai.com/v1`) ve anahtarını gir. Model listesi bu adresten çekilir.

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE).
