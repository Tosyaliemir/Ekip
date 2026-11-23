# Ekip

Claude Code için yalın bir çoklu ajan iş akışı. Bir oturumda **"Ekip ile yap"** de, gerisini o halletsin:

- **Opus** (ana oturumun) liderdir: planlar, zor kısımları kendisi yazar, son kararı verir.
- **Sonnet** işçiler rutin uygulamayı ve incelemeyi yapar.
- **Haiku** keşifçi yalnızca arar ve özetler; asla karar vermez.
- **Opus** doğrulayıcı, kritik bulguları ve riskli değişiklikleri bağımsız olarak kontrol eder.

Gerçek bir Agent Team yalnızca birbirine itiraz etmenin işe yaradığı iki durumda kurulur. Geri kalan her şey tek oturumda ya da ucuz subagent'larla yapılır.

## Nasıl çalışır

```
"Ekip ile yap: ..."  ──►  tetik.mjs hook'u  ──►  ekip:ekip skill'i yüklenir
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                   Solo                       Subagent'lar                    Takım
          1-2 dosya, sıralı iş       bağımsız parçalar (varsayılan)     yalnızca 2 durum*
                     └────────────────────────────┼────────────────────────────┘
                                                  ▼
                           Kapı: build/test + gerekirse Opus doğrulayıcı
```

\* (a) nedeni belirsiz, 2-3 rakip açıklaması olan hata: her hipotezi ayrı bir üye test eder ve diğerlerini çürütmeye çalışır. (b) İncelemecilerin birbirine itiraz etmesi gereken kritik bir inceleme.

| Rol | Model | Yetki | Görev |
|---|---|---|---|
| lider (ana oturum) | Opus | hepsi | plan, mimari, zor kod, ortak sözleşmeler, son karar |
| `kesif` | Haiku | salt okunur | dosya ve sembol bulma; log ve uzun dosya özetleme |
| `uygulayici` | Sonnet | yazabilir | kendi dosyalarında, en küçük diff ile rutin uygulama |
| `inceleyici` | Sonnet | salt okunur | tek bir mercekle inceleme ya da tek bir hata hipotezi |
| `dogrulayici` | Opus | salt okunur | iddiaları kendisi çalıştırarak doğrular |

Sınırlar:
- Aynı anda en fazla 4 subagent ve 3 takım üyesi çalışır; ayrı bir "lider" üye yoktur.
- Subagent'ların her birinde `maxTurns` sınırı ve 150-200 kelimelik rapor şablonu var.
- Hiçbir şey Fable'a bağlı değil.

## Kurulum

**Gerekenler:**
- Claude Code **v2.1.288 veya üstü** (plugin ajanlarının kendi promptlarıyla çalışmasını sağlayan düzeltme bu sürümde geldi). v2.1.329+ öneriliyor. Sürümünü `claude --version` ile görebilirsin.
- `PATH`'te **Node.js**. Hook'lar Node ile çalışıyor, böylece Windows'ta ve Linux'ta aynı kod kullanılıyor.

1. Claude Code içinde:
   ```
   /plugin marketplace add Tosyaliemir/ekip
   /plugin install ekip@ekip
   ```
2. Ayarlar. Plugin'ler ortam değişkeni ayarlayamadığı için bunu senin yapman gerekiyor. [`examples/settings.json`](examples/settings.json) dosyasındaki içeriği `~/.claude/settings.json` dosyana ekle:
   - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` takım modunu açar. **Bedeli:** takımlar açıkken Claude, isim verdiği her subagent'ı takım üyesi olarak başlatır. Bu, Ekip kullanmadığın oturumlarda da geçerlidir. Bunu istemiyorsan satırı global ayara değil, yalnızca istediğin projelerin `.claude/settings.local.json` dosyasına koy. Takımlar kapalıyken de Ekip çalışır; takım vakaları subagent'larla yürür, sadece üyeler birbiriyle doğrudan tartışamaz.
   - `permissions.allow` sık kullanılan okuma ve test komutlarına önceden izin verir. Takım üyelerinin izin istemleri senin oturumunda çıkar ve cevap bekleyen bir üye ilerleyemez.
   - `teammateMode`: `in-process` bırak. Her terminalde çalışır; Windows Terminal split-pane desteklemiyor. CachyOS'ta tmux içinde `auto` da kullanılabilir.
3. Claude Code'u yeniden başlat ve dene:
   ```
   Ekip ile yap: son commit'i incele
   ```

Elle çağırmak için `/ekip:ekip <görev>` de kullanılabilir.

## Tetikleyen ifadeler

**Tetikler:**
- Türkçe: `Ekip ile yap`, `ekip ile …`, `ekiple …`, `ekip'le …`, `ekibimle …`, `ekip olarak …`, `ekipçe …`, `bunu ekibe ver`, `takımla yap`
- İngilizce: `do it with the team`, `fix this as a team`, `use the team`, `use agent team`

Büyük harf ve Türkçe İ/ı sorun çıkarmaz.

**Tetiklemez:** "ekipman", "ekipler", "ekip ile ilgili …", "ekiple konuştum", "ekibe verilen …", "I met with the team".

Kaçan ya da yanlış yakalanan bir ifade olursa skill'in kendi açıklaması da Claude'u yönlendirir; hook'un eklediği not da "konu plugin'in kendisi ya da insan ekibiyse yok say" der.

## İsteğe bağlı kalite kapısı

Bir `uygulayici` işini bitirdiğinde projenin kontrol komutunu çalıştırmak için **kendi** `~/.claude/ekip-gates.json` dosyana proje yolunu ve komutu yaz (örnek: [`examples/ekip-gates.json`](examples/ekip-gates.json)):

```json
{ "C:/Users/Emir/projeler/sahne": "cargo check -q",
  "/home/emir/projeler/sahne": { "check": "cargo check -q", "timeoutSec": 300 } }
```

- Kontrol başarısız olursa çıktısı uygulayıcıya gönderilir ve düzeltmesi için **bir** şans daha verilir; döngü oluşmaz.
- Komut yalnızca senin ev dizinindeki bu dosyadan okunur. Klonladığın bir depo kendi içinden komut çalıştıramaz.
- Hızlı bir komut seç (`cargo check`, `pytest -q -x`). Paralel uygulayıcılar aynı anda bitirirse kapı birkaç kez üst üste çalışabilir. Windows'ta zaman aşımı alt süreçleri her zaman öldüremeyebilir.
- Kapı yalnızca subagent olarak çalışan uygulayıcılarda devreye girer. Takım modunda kontrolü lider yapar.

## Maliyet

- Takım modu, üye başına kabaca tam bir oturum kadar kullanım harcar; bu yüzden yalnızca iki durumda kurulur.
- Limitlere yaklaşınca en etkili adım takımları kapatmak: `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "0"`. Bu ayar çalışan oturuma hemen uygulanır.
- `CLAUDE_CODE_SUBAGENT_MODEL` ile `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` kullanmanı **önermiyorum**: Opus doğrulayıcıyı ucuzlatırken Haiku keşifçiyi de pahalı modele yükseltir.
- Kimin ne kadar harcadığını `/usage` komutuyla görebilirsin.

## Bilinen sınırlamalar

Claude Code dokümanına göre:
- Agent Teams hâlâ deneysel. `/resume` ve `/rewind` süreç içi üyeleri geri getirmez.
- Takım üyeleri ajan tanımındaki `maxTurns` ve `omitClaudeMd` ayarlarını almaz. Bu yüzden lider üyelere küçük ve somut görevler verir.
- Planında olmayan bir model istenirse Claude Code başka bir modele geçer. Subagent'larda uyarı verir, takım üyelerinde vermez.

GitHub'daki kullanıcı bildirimlerine göre (her sürümde geçerli olmayabilir):
- Windows'ta çok uzun takım oturumlarında lider takılabiliyor. Takım işleri için taze oturum aç.
- Süreç içi üyenin başlığında liderin modeli görünebiliyor. Gerçek modeli `/tasks` ile kontrol et.

## Geliştirme

```
node --test tests/hooks.test.mjs      # hook testleri (tetikleyici ve kapı)
claude plugin validate .              # plugin ve marketplace doğrulama
```

## Lisans

MIT. wshobson/agents, agency-agents ve obra/superpowers'tan alınan fikirler yeniden yazıldı; ayrıntılar [LICENSE](LICENSE) dosyasında.
