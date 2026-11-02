# Open Crow

Kendi API anahtarınla çalışan, masaüstü için sohbet tabanlı kodlama asistanı. Hesap, giriş ya da sunucu gerektirmez.

## Özellikler

- Çalışma klasörü seçersin; asistan o klasördeki dosyaları okuyabilir, arayabilir, düzenleyebilir ve komut çalıştırabilir
- Araç kullanımı görünür: her adım bir kart olarak akar, açılıp ayrıntısına bakılabilir
- Onay modları: her değişikliği sor, yalnızca düzenlemeleri otomatik onayla, ya da her şeyi otomatik onayla
- Düzenlemeler tam eşleşme ile yapılır ve diff olarak onaylanır
- Yanıtlar akarak gelir; kod blokları kopyalanabilir
- OpenAI uyumlu herhangi bir sağlayıcıyla çalışır (adres + anahtar)
- Oturumlar ve anahtar yalnızca bu bilgisayarda saklanır; araçlar çalışma klasörünün dışına çıkamaz

## Kurulum

```bash
npm install
npm run dev        # geliştirme
npm test           # testler
npm run dist:win   # Windows kurulum dosyası
```

## Kullanım

1. Ayarlar bölümünden API adresini (örneğin `https://api.openai.com/v1`) ve anahtarını gir. Model listesi bu adresten çekilir.
2. Üst çubuktan bir çalışma klasörü seç.
3. İstediğini yaz. Araç kullanımı gerektiğinde kartlar belirir; onay gerektiren işlemlerde İzin ver / Reddet seçeneği çıkar.

Araç çağrıları OpenAI uyumlu `tools` alanıyla yapılır; sağlayıcının araç çağrısını desteklemesi gerekir.

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE).
