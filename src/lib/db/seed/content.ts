import type { Banner, CmsPage } from "@/lib/types/domain";
import { DAY, L, type SeedClock } from "./util";

/* ------------------------------------------------------------------ banners */

export function buildBanners(clock: SeedClock): Banner[] {
  const stamp = { createdAt: clock.ago(60 * DAY), updatedAt: clock.ago(5 * DAY) };
  return [
    {
      id: "ban_hero_fit",
      placement: "home_hero",
      title: L("The right part for your exact car", "Aracınıza tam uyan parça"),
      subtitle: L(
        "Pick your make, model and engine once. We show only the parts that fit.",
        "Marka, model ve motorunuzu bir kez seçin. Biz yalnızca uyan parçaları gösterelim.",
      ),
      ctaLabel: L("Find parts for your car", "Aracınıza uygun parçaları bulun"),
      ctaHref: "/shop",
      image: "/products/banner-fitment.svg",
      tone: "dark",
      isActive: true,
      sortOrder: 0,
      ...stamp,
    },
    {
      id: "ban_hero_brakes",
      placement: "home_hero",
      title: L("Stop sooner. Stop quieter.", "Daha erken dur. Daha sessiz dur."),
      subtitle: L("Ceramic pads and vented discs from Torqvane, Veloxa and Stoppix. Take 15% off with BRAKES15.", "Torqvane, Veloxa ve Stoppix seramik balata ve havalandırmalı diskler. BRAKES15 koduyla %15 indirim."),
      ctaLabel: L("Shop brakes", "Frenleri incele"),
      ctaHref: "/category/brakes",
      image: "/products/banner-brakes.svg",
      tone: "orange",
      endsAt: clock.ahead(20 * DAY),
      isActive: true,
      sortOrder: 1,
      ...stamp,
    },
    {
      id: "ban_hero_service",
      placement: "home_hero",
      title: L("Service season starts here", "Bakım sezonu burada başlıyor"),
      subtitle: L("Oil, filters and fluids at workshop prices, delivered to your door.", "Yağ, filtre ve sıvılar atölye fiyatlarıyla kapınıza gelsin."),
      ctaLabel: L("Shop service parts", "Bakım parçalarını incele"),
      ctaHref: "/category/filters",
      image: "/products/banner-service.svg",
      tone: "dark",
      isActive: true,
      sortOrder: 2,
      ...stamp,
    },
    {
      id: "ban_promo_deals",
      placement: "home_promo",
      title: L("This week's deals", "Haftanın fırsatları"),
      subtitle: L("Up to 20% off selected parts while stock lasts.", "Seçili parçalarda stoklarla sınırlı %20'ye varan indirim."),
      ctaLabel: L("See all deals", "Tüm fırsatları gör"),
      ctaHref: "/deals",
      image: "/products/banner-deals.svg",
      tone: "orange",
      isActive: true,
      sortOrder: 0,
      ...stamp,
    },
    {
      id: "ban_promo_select",
      placement: "home_promo",
      title: L("APEXLINE Select", "APEXLINE Select"),
      subtitle: L("Our own range, tested to OE standards and priced for the workshop.", "Kendi serimiz: OE standartlarında test edilir, atölye bütçesine uygun fiyatlanır."),
      ctaLabel: L("Explore the range", "Seriyi keşfet"),
      ctaHref: "/brand/apexline-select",
      image: "/products/banner-select.svg",
      tone: "light",
      isActive: true,
      sortOrder: 1,
      ...stamp,
    },
    {
      id: "ban_announce_ship",
      placement: "announcement",
      title: L("Free US shipping over $99", "99 $ üzeri ücretsiz kargo"),
      subtitle: L("Use code WELCOME10 for 10% off your first order.", "İlk siparişinizde %10 indirim için WELCOME10 kodunu kullanın."),
      ctaLabel: L("Shipping info", "Kargo bilgisi"),
      ctaHref: "/pages/shipping",
      tone: "dark",
      isActive: true,
      sortOrder: 0,
      ...stamp,
    },
    {
      id: "ban_announce_old",
      placement: "announcement",
      title: L("Spring sale: 20% off with SPRING20", "Bahar indirimi: SPRING20 ile %20"),
      subtitle: L("Ended.", "Sona erdi."),
      ctaLabel: L("Shop now", "Alışveriş yap"),
      ctaHref: "/shop",
      tone: "orange",
      startsAt: clock.ago(75 * DAY),
      endsAt: clock.ago(40 * DAY),
      isActive: true,
      sortOrder: 1,
      ...stamp,
    },
    {
      id: "ban_category_top",
      placement: "category_top",
      title: L("Not sure it fits? We check for you.", "Uyup uymadığından emin değil misiniz? Biz kontrol edelim."),
      subtitle: L("Choose your vehicle and every product page shows a clear fit or no-fit answer.", "Aracınızı seçin; her ürün sayfası net bir uyar/uymaz yanıtı göstersin."),
      ctaLabel: L("Select your vehicle", "Aracınızı seçin"),
      ctaHref: "/garage",
      tone: "light",
      isActive: true,
      sortOrder: 0,
      ...stamp,
    },
  ];
}

/* ------------------------------------------------------------------ CMS pages */

const ABOUT_EN = `APEXLINE started in 2012 as a single workbench in a Detroit garage. Two mechanics got tired of ordering parts that almost fit, so they began cataloguing exactly which part fits which car, then supplying the workshops around them.

Today we ship precision-engineered brake, engine, suspension, cooling and electrical parts to workshops and drivers across the United States, Canada, Europe and Türkiye.

## What we stand for

- **Fit first.** Every product is mapped to specific vehicles, so you buy once and it fits.
- **Workshop-grade quality.** Our own APEXLINE Select range is tested to original-equipment standards before it reaches the shelf.
- **Honest advice.** Our technical team answers the phone and will tell you when you do not need a part.

## By the numbers

| Metric | Value |
|---|---|
| Parts catalogued | 120+ |
| Vehicle configurations | 40+ |
| Countries served | 9 |
| Average dispatch time | Same day |

Questions? Write to us through the [contact page](/contact) and a real person will reply within one business day.`;

const ABOUT_TR = `APEXLINE, 2012'de Detroit'te bir garajdaki tek bir tezgâhla başladı. İki tamirci, neredeyse uyan parçalar sipariş etmekten bıktı; hangi parçanın hangi araca uyduğunu kataloglamaya başladılar ve çevrelerindeki atölyelere tedarik ettiler.

Bugün Amerika Birleşik Devletleri, Kanada, Avrupa ve Türkiye'deki atölyelere ve sürücülere hassas mühendislikle üretilmiş fren, motor, süspansiyon, soğutma ve elektrik parçaları gönderiyoruz.

## Neye inanıyoruz

- **Önce uyum.** Her ürün belirli araçlarla eşleştirilir; bir kez alırsınız ve uyar.
- **Atölye kalitesi.** Kendi APEXLINE Select serimiz raflara ulaşmadan önce orijinal ekipman standartlarında test edilir.
- **Dürüst tavsiye.** Teknik ekibimiz telefona cevap verir ve bir parçaya ihtiyacınız olmadığında bunu söyler.

## Rakamlarla

| Gösterge | Değer |
|---|---|
| Kataloglanan parça | 120+ |
| Araç konfigürasyonu | 40+ |
| Hizmet verilen ülke | 9 |
| Ortalama sevkiyat süresi | Aynı gün |

Sorularınız mı var? [İletişim sayfası](/contact) üzerinden yazın; bir çalışanımız bir iş günü içinde yanıtlayacaktır.`;

const SHIPPING_EN = `We dispatch most in-stock orders the same business day if they are placed before 15:00 Eastern Time (ET).

## Delivery options

| Method | Where | Typical delivery | Price |
|---|---|---|---|
| Standard Ground | US and Canada | 3-6 business days | $7.99, free over $99 |
| Express 2-Day | United States | 1-2 business days | $19.99 |
| Warehouse Pickup | Detroit, MI | Ready in about 2 hours | Free |
| International Economy | UK and EU | 7-14 business days | $24.99, free over $299 |
| Türkiye Courier | Türkiye | 2-4 business days | $4.99, free over $75 |

Heavy items such as radiators, exhaust systems and batteries add a small per-kilogram charge, shown at checkout before you pay.

## Tracking

As soon as your parcel leaves our warehouse you will receive an email with the carrier and tracking number. You can also follow it from [Track your order](/track-order) or your account.

## Taxes and duties

Sales tax and VAT are calculated at checkout for the destination. For shipments outside the United States, customs duties may be charged by your local authority.

## Damaged or missing parcels

Photograph the packaging and contact us within 7 days of delivery and we will send a replacement or refund at no cost to you.`;

const SHIPPING_TR = `Stoktaki siparişlerin çoğunu, Doğu Saati ile 15:00'ten önce verilmişse aynı iş günü sevk ediyoruz.

## Teslimat seçenekleri

| Yöntem | Bölge | Tahmini teslimat | Ücret |
|---|---|---|---|
| Standart Kara Kargo | ABD ve Kanada | 3-6 iş günü | 7,99 $, 99 $ üzeri ücretsiz |
| Ekspres 2 Gün | Amerika Birleşik Devletleri | 1-2 iş günü | 19,99 $ |
| Depodan Teslim Alma | Detroit, MI | Yaklaşık 2 saatte hazır | Ücretsiz |
| Uluslararası Ekonomik | Birleşik Krallık ve AB | 7-14 iş günü | 24,99 $, 299 $ üzeri ücretsiz |
| Türkiye Kargo | Türkiye | 2-4 iş günü | 4,99 $, 75 $ üzeri ücretsiz |

Radyatör, egzoz sistemi ve akü gibi ağır ürünlerde küçük bir kilogram başına ücret eklenir; ödeme öncesinde ödeme sayfasında gösterilir.

## Takip

Paketiniz depodan çıkar çıkmaz kargo firması ve takip numarasıyla bir e-posta alırsınız. Ayrıca [Siparişini takip et](/track-order) sayfasından veya hesabınızdan izleyebilirsiniz.

## Vergiler ve gümrük

Satış vergisi ve KDV, teslimat adresine göre ödeme sayfasında hesaplanır. ABD dışına gönderilerde yerel makamlar gümrük vergisi talep edebilir.

## Hasarlı veya eksik paketler

Teslimattan sonra 7 gün içinde ambalajın fotoğrafını çekip bize ulaşın; size ücretsiz olarak yeni bir ürün gönderelim veya iade yapalım.`;

const RETURNS_EN = `Changed your mind or ordered the wrong part? You have **30 days** from delivery to return unused parts in their original packaging.

## How to return

1. Sign in to your account, open the order and choose **Request a return**, or [contact us](/contact) with your order number.
2. We will email you a prepaid return label (US orders) or return instructions (international orders).
3. Pack the part securely in its original box and send it back.
4. Once it arrives and passes inspection, we refund the original payment method within 5 business days.

## What we cannot take back

- Electrical parts (sensors, relays, ECUs) that have been installed or show signs of use
- Fluids and chemicals once the seal is broken
- Special-order parts, unless they are faulty

## Warranty claims

Most parts carry a manufacturer warranty of 12 to 48 months, shown on the product page. If a part fails because of a defect, send us the order number and a photo of the part and we will replace it or refund you, including the cost of shipping it back.

## Wrong or damaged item

If we sent the wrong part, or it arrived damaged, we pay for the return and ship the correct item with priority handling.`;

const RETURNS_TR = `Fikrinizi mi değiştirdiniz veya yanlış parça mı sipariş ettiniz? Kullanılmamış parçaları orijinal ambalajında teslimattan itibaren **30 gün** içinde iade edebilirsiniz.

## Nasıl iade edilir

1. Hesabınıza giriş yapın, siparişi açın ve **İade talep et** seçeneğini seçin veya sipariş numaranızla [bize ulaşın](/contact).
2. Size ön ödemeli iade etiketi (ABD siparişleri) veya iade talimatlarını (uluslararası siparişler) e-posta ile göndeririz.
3. Parçayı orijinal kutusunda sağlam şekilde paketleyip geri gönderin.
4. Parça elimize ulaşıp kontrolden geçtikten sonra ödemeyi 5 iş günü içinde ilk ödeme yöntemine iade ederiz.

## Kabul edemediklerimiz

- Takılmış veya kullanım izi taşıyan elektrikli parçalar (sensör, röle, kontrol ünitesi)
- Mührü açılmış sıvı ve kimyasallar
- Arızalı olmadıkça özel sipariş parçalar

## Garanti talepleri

Parçaların çoğu, ürün sayfasında belirtilen 12 ila 48 ay arası üretici garantisine sahiptir. Bir parça üretim hatası nedeniyle arızalanırsa sipariş numaranızı ve parçanın fotoğrafını bize gönderin; geri gönderim masrafı dahil olmak üzere değiştirir veya iade ederiz.

## Yanlış veya hasarlı ürün

Yanlış parça gönderdiysek veya hasarlı ulaştıysa iade masrafını biz öder, doğru ürünü öncelikli olarak göndeririz.`;

const PRIVACY_EN = `This policy explains what personal data APEXLINE collects, why, and how you can control it.

## What we collect

- **Account and order data:** name, email, phone number, delivery and billing addresses and your order history.
- **Payment data:** card details are handled by our payment provider. We store only the card brand, last four digits and expiry date.
- **Vehicle selection:** the vehicle you pick in the finder is stored in a cookie on your device so we can show parts that fit.
- **Usage data:** pages viewed and searches made, in aggregate, to improve the shop.

## How we use it

To fulfil orders, provide support, prevent fraud, meet legal obligations and, only if you opt in, send marketing emails. You can unsubscribe at any time with one click.

## Cookies

We use essential cookies for your session, cart and language, plus a cookie that remembers your vehicle. We do not use advertising cookies.

## Your rights

You can access, correct, export or delete your data from your account, or by [contacting us](/contact). Deleting your account anonymises past orders, which we must retain for tax purposes.

## Retention and security

We keep order records for 7 years as required by law. Data is transmitted over HTTPS and access is restricted to staff who need it.`;

const PRIVACY_TR = `Bu politika, APEXLINE'ın hangi kişisel verileri neden topladığını ve bunları nasıl kontrol edebileceğinizi açıklar.

## Neler topluyoruz

- **Hesap ve sipariş verileri:** ad, e-posta, telefon numarası, teslimat ve fatura adresleri ile sipariş geçmişiniz.
- **Ödeme verileri:** Kart bilgileri ödeme sağlayıcımız tarafından işlenir. Biz yalnızca kart markasını, son dört haneyi ve son kullanma tarihini saklarız.
- **Araç seçimi:** Araç seçicide seçtiğiniz araç, uyan parçaları gösterebilmemiz için cihazınızda bir çerezde saklanır.
- **Kullanım verileri:** Mağazayı iyileştirmek için toplu halde görüntülenen sayfalar ve yapılan aramalar.

## Nasıl kullanıyoruz

Siparişleri yerine getirmek, destek sağlamak, dolandırıcılığı önlemek, yasal yükümlülükleri yerine getirmek ve yalnızca onay vermeniz halinde pazarlama e-postaları göndermek için. İstediğiniz zaman tek tıkla abonelikten çıkabilirsiniz.

## Çerezler

Oturumunuz, sepetiniz ve dil tercihiniz için zorunlu çerezler ile aracınızı hatırlayan bir çerez kullanırız. Reklam çerezi kullanmayız.

## Haklarınız

Verilerinize hesabınızdan veya [bize ulaşarak](/contact) erişebilir, düzeltebilir, dışa aktarabilir veya silebilirsiniz. Hesabınızı silmek, vergi nedeniyle saklamamız gereken geçmiş siparişleri anonimleştirir.

## Saklama ve güvenlik

Sipariş kayıtlarını yasaların gerektirdiği şekilde 7 yıl saklarız. Veriler HTTPS ile iletilir ve erişim yalnızca ihtiyacı olan personelle sınırlıdır.`;

const TERMS_EN = `By using this website and placing an order you agree to the following terms.

## Orders and pricing

All prices are shown in US dollars (or converted to Turkish lira at the displayed rate) and exclude tax and shipping unless stated. A contract is formed when we confirm your order by email. We may cancel an order if a price or stock error is found, and will refund you in full.

## Fitment

We take great care to map parts to vehicles, but you are responsible for checking that a part suits your vehicle, for example by using the fitment checker and comparing the OE numbers. If a part marked as fitting your vehicle does not, we will arrange a free return.

## Installation and safety

Brakes, steering and suspension parts affect safety. They must be fitted by a competent person following the manufacturer's procedure. APEXLINE is not liable for damage resulting from incorrect installation.

## Payments

Payment is taken when you place your order. Orders that are not paid within 30 minutes are cancelled and the stock is released.

## Liability

Nothing in these terms limits liability that cannot be limited by law. Otherwise our liability is limited to the price paid for the product concerned.

## Changes and governing law

We may update these terms; the version in force at the time of your order applies. These terms are governed by the laws of the State of Michigan, USA, without affecting your mandatory consumer rights in your country of residence.`;

const TERMS_TR = `Bu web sitesini kullanarak ve sipariş vererek aşağıdaki şartları kabul etmiş olursunuz.

## Siparişler ve fiyatlandırma

Tüm fiyatlar ABD doları cinsinden (veya gösterilen kurla Türk lirasına çevrilmiş olarak) gösterilir; aksi belirtilmedikçe vergi ve kargo hariçtir. Sözleşme, siparişinizi e-posta ile onayladığımızda kurulur. Fiyat veya stok hatası tespit edersek siparişi iptal edebiliriz; bu durumda ödemenizin tamamı iade edilir.

## Uyumluluk

Parçaları araçlarla eşleştirmek için büyük özen gösteririz ancak bir parçanın aracınıza uygunluğunu, örneğin uyumluluk denetleyicisini kullanarak ve OE numaralarını karşılaştırarak kontrol etmek sizin sorumluluğunuzdadır. Aracınıza uyduğu belirtilen bir parça uymazsa ücretsiz iade ayarlarız.

## Montaj ve güvenlik

Fren, direksiyon ve süspansiyon parçaları güvenliği etkiler. Üreticinin prosedürüne uygun olarak yetkin bir kişi tarafından takılmalıdır. APEXLINE hatalı montajdan kaynaklanan zararlardan sorumlu değildir.

## Ödemeler

Ödeme siparişiniz verildiğinde alınır. 30 dakika içinde ödenmeyen siparişler iptal edilir ve stok serbest bırakılır.

## Sorumluluk

Bu şartlardaki hiçbir hüküm, yasalarla sınırlandırılamayan sorumluluğu sınırlamaz. Bunun dışında sorumluluğumuz ilgili ürün için ödenen bedelle sınırlıdır.

## Değişiklikler ve uygulanacak hukuk

Bu şartları güncelleyebiliriz; siparişiniz sırasında yürürlükte olan sürüm geçerlidir. Bu şartlar, ikamet ettiğiniz ülkedeki zorunlu tüketici haklarınız saklı kalmak üzere ABD Michigan Eyaleti yasalarına tabidir.`;

const FAQ_EN = `## Will this part fit my car?

Select your vehicle with the **Find parts for your car** tool and every product page will tell you clearly whether it fits. You can also compare the OE numbers on the product page with the number on your old part.

## Do you sell genuine OEM parts?

We sell premium aftermarket parts made by independent manufacturers to original-equipment specifications, plus our own APEXLINE Select range. We list the OE numbers each part replaces.

## How long does delivery take?

In-stock orders usually leave the warehouse the same business day. See [Shipping](/pages/shipping) for delivery times by method.

## Can I return a part?

Yes. Unused parts can be returned within 30 days. Full details are on the [Returns](/pages/returns) page.

## What payment methods do you accept?

Major credit and debit cards. Your card details are never stored by us. In test mode, use card number 4242 4242 4242 4242 with any future expiry date and any three-digit CVC.

## Can I change or cancel my order?

You can cancel from your account while the order is still processing. Once an order has shipped, you can refuse delivery or use our returns process.

## Do I need to buy parts in pairs?

Brake pads, discs, shocks and springs should be replaced in axle sets so that the car brakes and handles evenly. Where we sell a pair or a set, the product title says so.

## How do I contact support?

Use the [contact page](/contact) or call +1 (555) 013-0420 on weekdays from 08:00 to 18:00 (UTC).`;

const FAQ_TR = `## Bu parça aracıma uyar mı?

**Aracınıza uygun parçaları bulun** aracıyla aracınızı seçin; her ürün sayfası uyup uymadığını net şekilde söyler. Ayrıca ürün sayfasındaki OE numaralarını eski parçanızın üzerindeki numarayla karşılaştırabilirsiniz.

## Orijinal OEM parça satıyor musunuz?

Orijinal ekipman spesifikasyonlarında bağımsız üreticiler tarafından üretilen üst kalite yan sanayi parçalarını ve kendi APEXLINE Select serimizi satıyoruz. Her parçanın hangi OE numaralarının yerine geçtiğini listeliyoruz.

## Teslimat ne kadar sürer?

Stoktaki siparişler genellikle aynı iş günü depodan çıkar. Yönteme göre teslimat süreleri için [Kargo](/pages/shipping) sayfasına bakın.

## Parça iade edebilir miyim?

Evet. Kullanılmamış parçalar 30 gün içinde iade edilebilir. Ayrıntılar [İade](/pages/returns) sayfasındadır.

## Hangi ödeme yöntemlerini kabul ediyorsunuz?

Başlıca kredi ve banka kartları. Kart bilgileriniz bizde saklanmaz. Test modunda 4242 4242 4242 4242 numaralı kartı, gelecekteki herhangi bir son kullanma tarihi ve herhangi bir üç haneli CVC ile kullanın.

## Siparişimi değiştirebilir veya iptal edebilir miyim?

Sipariş hâlâ hazırlanıyorken hesabınızdan iptal edebilirsiniz. Sipariş kargoya verildikten sonra teslimatı reddedebilir veya iade sürecimizi kullanabilirsiniz.

## Parçaları çift olarak mı almalıyım?

Fren balataları, diskler, amortisörler ve yaylar araç dengeli fren yapsın ve yol tutsun diye aks takımı olarak değiştirilmelidir. Çift veya set sattığımız ürünlerde ürün başlığı bunu belirtir.

## Destek ile nasıl iletişime geçerim?

[İletişim sayfasını](/contact) kullanın veya hafta içi 08:00-18:00 (UTC) arası +1 (555) 013-0420 numarasını arayın.`;

export function buildPages(clock: SeedClock): CmsPage[] {
  const stamp = { createdAt: clock.ago(300 * DAY), updatedAt: clock.ago(25 * DAY) };
  const page = (
    slug: string,
    sortOrder: number,
    title: [string, string],
    body: [string, string],
    seo: [string, string],
  ): CmsPage => ({
    id: `pge_${slug}`,
    slug,
    title: L(title[0], title[1]),
    body: L(body[0], body[1]),
    isPublished: true,
    showInFooter: true,
    sortOrder,
    seoDescription: L(seo[0], seo[1]),
    ...stamp,
  });
  return [
    page("about", 0, ["About APEXLINE", "APEXLINE Hakkında"], [ABOUT_EN, ABOUT_TR], ["Meet the team behind APEXLINE Auto Parts and how we keep every part matched to your car.", "APEXLINE Auto Parts ekibini ve her parçayı aracınıza nasıl eşleştirdiğimizi tanıyın."]),
    page("shipping", 1, ["Shipping & Delivery", "Kargo ve Teslimat"], [SHIPPING_EN, SHIPPING_TR], ["Delivery options, prices and times for the US, Europe and Türkiye.", "ABD, Avrupa ve Türkiye için teslimat seçenekleri, ücretler ve süreler."]),
    page("returns", 2, ["Returns & Warranty", "İade ve Garanti"], [RETURNS_EN, RETURNS_TR], ["30-day returns and manufacturer warranty claims explained.", "30 günlük iade ve üretici garanti taleplerinin açıklaması."]),
    page("faq", 3, ["Frequently Asked Questions", "Sık Sorulan Sorular"], [FAQ_EN, FAQ_TR], ["Answers about fitment, delivery, returns and payments.", "Uyumluluk, teslimat, iade ve ödemeler hakkında yanıtlar."]),
    page("privacy", 4, ["Privacy Policy", "Gizlilik Politikası"], [PRIVACY_EN, PRIVACY_TR], ["How APEXLINE collects, uses and protects your personal data.", "APEXLINE kişisel verilerinizi nasıl toplar, kullanır ve korur."]),
    page("terms", 5, ["Terms & Conditions", "Kullanım Şartları"], [TERMS_EN, TERMS_TR], ["The terms that apply when you shop with APEXLINE Auto Parts.", "APEXLINE Auto Parts ile alışveriş yaparken geçerli şartlar."]),
  ];
}
