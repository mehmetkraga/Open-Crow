# Open Crow

Kendi API anahtarınla çalışan, masaüstü için sohbet tabanlı kodlama ajanı. Hesap, giriş ya da sunucu gerektirmez.

## Özellikler

- **Çalışma klasörü:** Asistan seçtiğin klasörde dosya okur, arar, düzenler ve komut çalıştırır. Araçların hepsi bu klasörün içinde kalır.
- **Görünür araç kullanımı:** Her adım bir kart olarak akar; açılıp ayrıntısına bakılabilir.
- **Onay modları:** `plan` (yalnızca oku), `ask` (her değişikliği sor), `edits` (düzenlemeleri otomatik onayla), `auto` (her şeyi onayla). Shift+Tab ile değiştirilir.
- **İzin kuralları:** `allow` / `deny` / `ask` listeleri. Değerlendirme sırası: önce reddet, sonra sor, sonra izin ver.
- **Denetim noktaları:** Her dosya değişikliğinin önceki hâli saklanır; `/geri-al` son turu geri alır.
- **Alt ajan:** Geniş taramalar `task` aracıyla salt okunur bir alt ajana devredilir; ana sohbete yalnızca özet döner.
- **Yapılacaklar ve web araması:** Çok adımlı işlerde `todo_write`; güncel bilgi için `web_search` ve `web_fetch`.
- **Proje belleği:** `OPENCROW.md`, `CLAUDE.md` ve `AGENTS.md` dosyaları her turda sistem istemine eklenir. `/init` ile `OPENCROW.md` oluşturulur.
- **Beceriler:** `.opencrow/skills/<ad>/SKILL.md` dosyaları `/ad` komutuyla çağrılır.
- **Slash komutları:** `/` yazınca palet açılır (`/yeni`, `/model`, `/mod`, `/stil`, `/ozet`, `/geri-al`, `/degisiklikler`, `/kopyala`, `/aktar`, `/bellek`, `/beceriler`, `/yardim` ...).
- **Uzun sohbetler:** `/ozet` konuşmayı özetler; sonraki istekler özetle devam eder.
- **Sıraya alma:** Yanıt sürerken yazılan mesaj bitince sırayla gönderilir.
- OpenAI uyumlu herhangi bir sağlayıcıyla çalışır (adres + anahtar).
- Oturumlar ve anahtar yalnızca bu bilgisayarda saklanır.

## Proje ayarları

Çalışma klasörünün kökünde isteğe bağlı dosyalar:

```
OPENCROW.md                       # proje talimatları (CLAUDE.md ve AGENTS.md da okunur)
.opencrow/settings.json           # izin kuralları
.opencrow/skills/<ad>/SKILL.md    # beceriler
```

`.opencrow/settings.json` örneği:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)", "Bash(npm run *)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(.env)", "Bash(rm *)"]
  }
}
```

Onay kartındaki **Hep izin ver** düğmesi, seçilen kalıbı oturuma ve bu klasöre kalıcı bir `allow` kuralı olarak ekler.

## Kurulum

```bash
npm install
npm run dev        # geliştirme
npm test           # testler
npm run dist:win   # Windows kurulum dosyası
```

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE).
