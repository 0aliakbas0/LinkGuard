# LinkGuard 🕵️‍♂️

Link Dedektifi, şüpheli linkleri analiz eden eğlenceli ve güçlü bir web uygulamasıdır. WHOIS bilgileri ve VirusTotal entegrasyonu ile link güvenliğini kontrol eder.

## Kurulum

1. **Projeyi Klonlayın:**


2. **Bağımlılıkları Yükleyin:**
   npm install

3. **`.env` Dosyasını Oluşturun ve API Anahtarlarını Ekleyin:**
   - Proje kök dizininde bir metin editörüyle `.env` adında bir dosya oluşturun.
   - Aşağıdaki bilgileri ekleyin (kendi API anahtarlarınızı WhoIsXML ve VirusTotal’dan alın):
     WHOISXML_API_KEY=Your_WhoisXML_API_Key
     VIRUSTOTAL_API_KEY=Your_VirusTotal_API_Key

4. **Backend Sunucusunu Başlatın:**
   node server.js
   Terminalde "Sunucu 3000 portunda çalışıyor!" mesajını görmelisiniz.

5. **Projeyi Test Edin:**
   - **Yöntem 1: Tarayıcıda Doğrudan Açın**
     Tarayıcıda `http://localhost:3000` adresine gidin (sunucu çalışıyorsa bu yöntemle çalışır).
   - **Yöntem 2: http-server ile Test Edin**
     Yeni bir terminal açın ve şu komutu çalıştırın:
     http-server
     Terminalde bir bağlantı çıkacak (örneğin `http://127.0.0.1:8080`). Bu bağlantıya tıklayın veya tarayıcınızda bu adrese gidin.

## Özellikler
- Şüpheli linkleri analiz eder.
- Karanlık mod desteği sunar.
- WHOIS bilgilerini görüntüler.
- VirusTotal entegrasyonu ile ek güvenlik analizi yapar.

## Lisans
[MIT Lisansı](LICENSE)

## Katkıda Bulunma
Proje geliştirmek isterseniz, lütfen bir pull request açın veya [issues](https://github.com/kullanici-adi/link-dedektifi/issues) bölümünde önerilerinizi paylaşın!
