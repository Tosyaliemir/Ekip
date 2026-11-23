# Ekip

Claude Code için yalın bir çoklu ajan iş akışı. Bir oturumda **"Ekip ile yap"** de, gerisini o halletsin:

- **Opus** (ana oturumun) liderdir: planlar, zor kısımları kendisi yazar, son kararı verir.
- **Sonnet** işçiler rutin uygulama ve incelemeyi yapar.
- **Haiku** keşifçi yalnızca arar ve özetler; hiçbir zaman karar vermez.
- **Opus** doğrulayıcı kritik bulguları ve riskli değişiklikleri bağımsız olarak kontrol eder.

Gerçek bir Agent Team yalnızca gerçekten kazandırdığı üç durumda kurulur. Geri kalan her şey ya tek oturumda ya da ucuz subagent'larla yapılır.

## Nasıl çalışır

```
"Ekip ile yap: ..."  ──►  tetik.mjs hook'u  ──►  ekip:ekip skill'i yüklenir
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                   Solo                       Subagent'lar                    Takım
           1-2 dosya, sıralı iş        bağımsız parçalar (varsayılan)   yalnızca 3 durum*
                     └────────────────────────────┼────────────────────────────┘
                                                  ▼
                              Kapı: build/test + gerekirse Opus doğrulayıcı
```

\* (a) nedeni belirsiz, 2-3 rakip açıklaması olan hata; (b) incelemecilerin birbirine itiraz etmesi gereken kritik inceleme; (c) dosya sahipliği net ayrılan, katmanlar arası özellik.

| Rol | Model | Yetki | Görev |
|---|---|---|---|
| lider (ana oturum) | Opus | hepsi | plan, mimari, zor kod, son karar |
| `kesif` | Haiku | salt okunur | dosya/sembol bulma, log ve uzun dosya özetleme |
| `uygulayici` | Sonnet | yazabilir | kendi dosyalarında en küçük diff ile rutin uygulama |
| `inceleyici` | Sonnet | salt okunur | tek mercekle inceleme ya da tek hata hipotezi |
| `dogrulayici` | Opus | salt okunur | iddiaları kendisi çalıştırarak doğrulama |

Ayrıca:
- Aynı anda en fazla 4 subagent ve en fazla 3 takım üyesi çalışır; ayrı bir "lider" üye hiç yoktur.
- Her ajanın `maxTurns` sınırı ve 150-200 kelimelik rapor şablonu vardır.
- Hiçbir şey Fable'a bağlı değildir.

## Kurulum

**Gerekenler:** Claude Code **v2.1.329 veya üstü** (`claude --version`) ve `PATH`'te **Node.js**. Hook'lar Node ile çalışır, böylece Windows'ta ve Linux'ta aynı kod kullanılır.

1. Claude Code içinde:
   ```
   /plugin marketplace add Tosyaliemir/ekip
   /plugin install ekip@ekip
   ```
2. `~/.claude/settings.json` dosyana [`examples/settings.json`](examples/settings.json) içeriğini ekle. Plugin'ler ortam değişkeni ayarlayamadığı için bu adımı senin yapman gerekiyor:
   - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` takım modunu açar. Açmazsan Ekip yine çalışır, ama "Takım" modu subagent'larla yürür.
   - `permissions.allow` satırları sık kullanılan okuma ve test komutlarına önceden izin verir. Takımda tek bir cevaplanmamış izin istemi bütün üyelerin mesajlarını bekletebildiği için bu önemli.
   - `teammateMode`: Windows'ta `in-process` kalsın. CachyOS'ta tmux içinde çalışıyorsan, her üyeyi ayrı panelde görmek için `auto` yapabilirsin.
3. Claude Code'u yeniden başlat ve dene:
   ```
   Ekip ile yap: son commit'i incele
   ```

Elle çağırmak için `/ekip:ekip <görev>` de kullanılabilir.

## Tetikleyen ifadeler

`Ekip ile yap`, `ekip ile …`, `ekiple …`, `ekip olarak …`, `ekipçe …`, `bunu ekibe ver`, `do it with the team`, `use the team`

Büyük harf ve Türkçe İ/ı sorun çıkarmaz. "ekipman", "ekipler" gibi kelimeler tetiklemez. Plugin'in kendisinden ya da insan ekibinden söz ediyorsan, Claude bu notu yok sayar.

## İsteğe bağlı kalite kapısı

Projenin kökünde `.claude/ekip.json` dosyası varsa, her `uygulayici` işini bitirdiğinde oradaki kontrol komutu çalışır:

```json
{ "check": "cargo check -q", "timeoutSec": 300 }
```

- Kontrol başarısız olursa çıktısı uygulayıcıya geri gönderilir ve düzeltmesi için **bir** şans daha verilir; sonsuz döngü oluşmaz.
- Dosya yoksa kapı hiçbir şey yapmaz.
- ⚠️ Bu komut, o projede bir `uygulayici` işini bitirdiğinde **senin makinende** çalışır. Güvenmediğin bir depodaki `.claude/ekip.json` dosyasını önce oku.

## Maliyet

- Takım modu, takım üyesi başına kabaca tam bir oturum kadar kullanım harcar. Bu yüzden yalnızca yukarıdaki üç durumda kurulur.
- Limitlere yaklaştığında iki seçenek var:
  - Tüm işçileri Sonnet'e zorlamak için `settings.json` → `env` içine `"CLAUDE_CODE_SUBAGENT_MODEL": "sonnet"` ve `"CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"` ekle.
  - Takımları tamamen kapatmak için `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "0"` yap. Bu ayar çalışan oturuma da hemen uygulanır.
- Kimin ne kadar harcadığını `/usage` komutuyla görebilirsin.

## Bilinen sınırlamalar (Claude Code tarafında)

- Agent Teams hâlâ deneysel. `/resume` ve `/rewind` süreç içi üyeleri geri getirmez. Takım işleri için kısa ve taze oturumlar kullan; Windows'ta uzun oturumlarda liderin takıldığı bildirildi.
- Süreç içi üyelerin başlığında liderin modeli görünebilir; bu yalnızca bir görüntü hatası. Gerçek modeli `/tasks` ile kontrol et.
- Bir model planında yoksa Claude Code sessizce başka bir modele düşer.

## Geliştirme

```
node --test tests/hooks.test.mjs      # hook testleri
claude plugin validate .              # plugin ve marketplace doğrulama
```

## Lisans

MIT. wshobson/agents, agency-agents ve obra/superpowers'tan alınan fikirler yeniden yazıldı; ayrıntılar [LICENSE](LICENSE) dosyasında.
