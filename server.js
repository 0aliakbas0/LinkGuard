require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises; // Dosya işlemleri için
const cron = require('node-cron'); // Zamanlayıcı için
const app = express();

app.use(cors());
app.use(express.json());

// Blacklist dosyasını oku
let blacklist = [];
const blacklistFilePath = './blacklist.json';

// Blacklist dosyasını yükle
const loadBlacklist = async () => {
  try {
    const data = await fs.readFile(blacklistFilePath, 'utf8');
    blacklist = JSON.parse(data);
    console.log('Blacklist yüklendi:', blacklist.length, 'kayıt');
  } catch (error) {
    console.error('Blacklist yüklenirken hata:', error.message);
    blacklist = [];
  }
};

// Blacklist dosyasını güncelle ve kaydet
const saveBlacklist = async (newBlacklist) => {
  try {
    await fs.writeFile(blacklistFilePath, JSON.stringify(newBlacklist, null, 2));
    blacklist = newBlacklist;
    console.log('Blacklist güncellendi ve kaydedildi:', blacklist.length, 'kayıt');
  } catch (error) {
    console.error('Blacklist kaydedilirken hata:', error.message);
  }
};

// USOM listesinden URL’leri indir ve blacklist’e ekle
const updateBlacklistFromUSOM = async () => {
  console.log('USOM listesi güncelleniyor...');
  try {
    const response = await axios.get('https://www.usom.gov.tr/url-list.txt');
    const usomList = response.data
      .split('\n')
      .map(url => url.trim())
      .filter(url => url && !url.startsWith('#')); // Boş satırları ve yorum satırlarını filtrele

    console.log('USOM’dan alınan URL sayısı:', usomList.length);

    // Mevcut blacklist ile birleştir ve yinelenenleri temizle
    const combinedList = [...new Set([...blacklist, ...usomList])]; // Set ile yinelenenleri kaldır
    await saveBlacklist(combinedList);
  } catch (error) {
    console.error('USOM listesi alınırken hata:', error.message);
  }
};

// Sunucu başlatıldığında blacklist’i yükle
loadBlacklist();

// Her gün gece 03:00’te USOM listesini güncelle
cron.schedule('0 3 * * *', () => {
  console.log('Günlük USOM blacklist güncellemesi başlatıldı:', new Date().toISOString());
  updateBlacklistFromUSOM();
});

// URL doğrulama ve formatlama fonksiyonu
const normalizeUrl = (url) => {
  if (!url) return null;
  let normalized = url.trim();
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `https://${normalized}`;
  }
  try {
    new URL(normalized);
    return normalized;
  } catch (error) {
    console.error('Geçersiz URL formatı:', normalized, error.message);
    return null;
  }
};

// WHOIS Sorgu Endpoint’i
app.post('/whois', async (req, res) => {
  const { link } = req.body;

  if (!link) {
    return res.json({ status: 'error', message: 'Link girilmedi!' });
  }

  // URL’yi doğrula ve domain’i çıkar
  const normalizedLink = normalizeUrl(link);
  if (!normalizedLink) {
    return res.json({ status: 'error', message: 'Geçersiz URL formatı!' });
  }

  try {
    const url = new URL(normalizedLink);
    const domain = url.hostname;

    // WhoisXML API ile WHOIS sorgusu yap
    const apiKey = process.env.WHOISXML_API_KEY;
    if (!apiKey) {
      return res.json({ status: 'error', message: 'WHOISXML API anahtarı eksik!' });
    }

    const whoisResponse = await axios.get(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${domain}&outputFormat=JSON`
    );
    const whoisData = whoisResponse.data;

    if (whoisData.WhoisRecord) {
      const record = whoisData.WhoisRecord;
      const registrant = record.registrant || {};

      // Önemli WHOIS bilgilerini döndür
      const whoisInfo = {
        status: 'success',
        data: {
          owner: registrant.name || 'Bilinmiyor',
          email: registrant.email || 'Bilinmiyor',
          createdDate: record.createdDate || 'Bilinmiyor',
          expiresDate: record.expiresDate || 'Bilinmiyor',
          registrar: record.registrarName || 'Bilinmiyor',
        },
      };
      return res.json(whoisInfo);
    } else {
      return res.json({ status: 'error', message: 'WHOIS bilgileri alınamadı.' });
    }
  } catch (error) {
    console.error('WHOIS sorgu hatası:', error.message);
    return res.json({ status: 'error', message: 'WHOIS bilgileri alınırken bir hata oluştu.' });
  }
});

// Analiz endpoint’i
app.post('/analyze', async (req, res) => {
  const { link } = req.body;

  if (!link) {
    return res.json({ status: 'error', message: 'Link girilmedi!' });
  }

  // URL’yi doğrula ve formatla
  const normalizedLink = normalizeUrl(link);
  if (!normalizedLink) {
    return res.json({ status: 'error', message: 'Geçersiz URL formatı! Lütfen geçerli bir URL girin.' });
  }

  const suspiciousKeywords = ['login', 'verify', 'account', 'secure', 'update'];
  const dangerousDomains = ['.xyz', '.club', '.top'];
  const shortUrlDomains = ['bit.ly', 'tinyurl.com', 't.co'];
  const linkLower = normalizedLink.toLowerCase();

  let suspicionScore = 0;
  let details = [];

  // 1. Blacklist kontrolü
  if (blacklist.includes(normalizedLink)) {
    suspicionScore += 5;
    details.push('Bu link USOM blacklist’inde bulunuyor! (+5 puan)');
  }

  // 2. VirusTotal kontrolü (Harici API)
  const virusTotalApiKey = process.env.VIRUSTOTAL_API_KEY;
  if (virusTotalApiKey) {
    const virusTotalUrl = `https://www.virustotal.com/api/v3/urls`;
    console.log('VirusTotal isteği gönderiliyor:', virusTotalUrl);
    console.log('Gönderilen link:', normalizedLink);
    try {
      const hashResponse = await axios.post(
        virusTotalUrl,
        `url=${encodeURIComponent(normalizedLink)}`,
        {
          headers: {
            'x-apikey': virusTotalApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      console.log('Hash isteği yanıtı:', JSON.stringify(hashResponse.data));
      const analysisId = hashResponse.data.data.id;
      console.log('Analiz ID:', analysisId);

      let analysisComplete = false;
      let analysisResult;
      for (let i = 0; i < 24; i++) {
        const resultResponse = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          { headers: { 'x-apikey': virusTotalApiKey } }
        );
        console.log('Analiz durumu (iterasyon', i, '):', JSON.stringify(resultResponse.data));
        analysisResult = resultResponse.data.data.attributes;
        if (analysisResult.status === 'completed') {
          analysisComplete = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      if (analysisComplete) {
        const positives = analysisResult.stats.malicious || 0;
        const suspicious = analysisResult.stats.suspicious || 0;
        console.log('VirusTotal sonucu:', JSON.stringify(analysisResult));
        if (positives > 0 || suspicious > 0) {
          suspicionScore += 5;
          details.push(`VirusTotal: ${positives} antivirüs motoru bu linki kötü, ${suspicious} motor şüpheli buldu! (+5 puan)`);
        } else {
          details.push('VirusTotal: Bu link güvenli bulundu.');
          return res.json({ status: 'safe', details });
        }
      } else {
        details.push('VirusTotal analizi tamamlanamadı (zaman aşımı), manuel analiz devam ediyor.');
      }
    } catch (error) {
      console.error('VirusTotal API hatası:', error.response ? JSON.stringify(error.response.data) : error.message);
      if (error.response && error.response.status === 403) {
        details.push('VirusTotal API kotası aşılmış olabilir (403 Forbidden), manuel analiz devam ediyor.');
      } else if (error.response && error.response.status === 401) {
        details.push('VirusTotal API anahtarı geçersiz (401 Unauthorized), manuel analiz devam ediyor.');
      } else if (error.response && error.response.data.error && error.response.data.error.code === 'InvalidArgumentError') {
        details.push('VirusTotal: Geçersiz URL formatı, manuel analiz devam ediyor.');
      } else {
        details.push('VirusTotal API’si ile bağlantı kurulamadı, manuel analiz devam ediyor.');
      }
    }
  } else {
    details.push('VirusTotal API anahtarı eksik, manuel analiz yapılıyor.');
  }

  // 3. Manuel analiz kuralları
  if (!linkLower.startsWith('https')) {
    suspicionScore += 1;
    details.push('Bu link HTTPS kullanmıyor, dikkatli ol! (+1 puan)');
  }

  if (suspiciousKeywords.some(keyword => linkLower.includes(keyword))) {
    suspicionScore += 1;
    details.push('Linkte şüpheli kelimeler tespit edildi. (+1 puan)');
  }

  if (dangerousDomains.some(domain => linkLower.includes(domain))) {
    suspicionScore += 3;
    details.push('Bu domain tehlikeli olabilir! (+3 puan)');
  }

  if (normalizedLink.length > 100) {
    suspicionScore += 1;
    details.push('Bu link gereksiz uzun, şüpheli olabilir! (+1 puan)');
  }

  const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
  if (ipRegex.test(normalizedLink)) {
    suspicionScore += 2;
    details.push('Bu link bir IP adresi içeriyor, şüpheli olabilir! (+2 puan)');
  }

  const encodedCharRegex = /%[0-9A-Fa-f]{2}|[@!#\$%\^&\*]/;
  if (encodedCharRegex.test(normalizedLink)) {
    suspicionScore += 1;
    details.push('Bu linkte garip karakterler veya kodlamalar var, şüpheli olabilir! (+1 puan)');
  }

  const popularDomains = ['google', 'youtube', 'instagram', 'whatsapp', 'trendyol'];
  const domainMatch = linkLower.match(/:\/\/(.*?)(\/|$)/);
  if (domainMatch) {
    const domain = domainMatch[1].replace('www.', '');
    popularDomains.forEach(popular => {
      if (domain.includes(popular.replace('o', '0')) || domain.includes(popular.replace('a', '4'))) {
        suspicionScore += 2;
        details.push(`Bu domain (${domain}), popüler bir domaine (${popular}) benziyor, typo-squatting olabilir! (+2 puan)`);
      }
    });
  }

  let realUrl = normalizedLink;
  if (shortUrlDomains.some(domain => linkLower.includes(domain))) {
    suspicionScore += 1;
    details.push('Bu bir kısaltılmış URL, gerçek hedef analiz ediliyor (+1 puan)');
    try {
      const response = await axios.head(normalizedLink, { maxRedirects: 5 });
      realUrl = response.request.res.responseUrl;
      details.push(`Kısaltılmış URL'nin gerçek hedefi: ${realUrl}`);
      if (!realUrl.toLowerCase().startsWith('https')) {
        suspicionScore += 1;
        details.push('Gerçek URL HTTPS kullanmıyor! (+1 puan)');
      }
    } catch (error) {
      details.push('Kısaltılmış URL çözülemedi, daha dikkatli ol!');
    }
  }

  let status;
  if (suspicionScore >= 5) {
    status = 'dangerous';
  } else if (suspicionScore >= 2) {
    status = 'suspicious';
  } else {
    status = 'safe';
  }

  details.push(`Toplam Şüphe Puanı: ${suspicionScore}`);

  res.json({ status, details });
});

app.listen(3000, () => {
  console.log('Sunucu 3000 portunda çalışıyor...');
  // İlk çalıştırmada USOM listesini hemen güncelle
  updateBlacklistFromUSOM();
});