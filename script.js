let score = 0;
let badge = "Acemi Dedektif";
let lastResult = "";
let clickCount = 0;
let isDarkMode = false;

const sounds = {
  scan: new Audio("sounds/scan.mp3"),
  success: new Audio("sounds/success.mp3"),
  hmm: new Audio("sounds/hmm.mp3"),
  alert: new Audio("sounds/alert.mp3"),
};

// Whitelist ve Blacklist dosyalarını yükle
fetch('whitelist.json')
  .then(response => response.json())
  .then(data => {
    window.whitelist = data;
  })
  .catch(error => console.error("Whitelist yüklenirken hata oluştu:", error));

fetch('blacklist.json')
  .then(response => response.json())
  .then(data => {
    window.blacklist = data;
  })
  .catch(error => console.error("Blacklist yüklenirken hata oluştu:", error));

document.addEventListener("DOMContentLoaded", () => {
  gsap.from(".container", { duration: 1, y: -50, opacity: 0, ease: "bounce" });
  gsap.from("h1", { duration: 1.5, scale: 0.5, delay: 0.5, ease: "elastic" });
  showSpeech("Merhaba! Şüpheli bir link mi buldun? Hadi inceleyelim!");

  // Karanlık mod butonunu ayarla
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.textContent = isDarkMode ? "☀️" : "🌙";
    darkModeToggle.addEventListener("click", toggleDarkMode);
  } else {
    console.error("darkModeToggle elementi bulunamadı!");
  }

  // Lottie animasyonunu yükle
  const detective = document.getElementById("detective");
  if (!detective) {
    console.error("Dedektif elementi bulunamadı! #detective ID'si olan bir element olduğundan emin olun.");
    return;
  }

  try {
    const animation = lottie.loadAnimation({
      container: detective,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'animations/detective.json'
    });

    animation.addEventListener('DOMLoaded', () => {
      console.log("Dedektif animasyonu başarıyla yüklendi!");
    });

    animation.addEventListener('error', (error) => {
      console.error("Dedektif animasyonu yüklenirken bir hata oluştu:", error);
    });

    animation.addEventListener('data_failed', (error) => {
      console.error("Animasyon verisi yüklenemedi:", error);
    });

    detective.addEventListener("click", () => {
      clickCount++;
      if (clickCount === 3) {
        showSpeech("Hihihi! Dans vakti!");
        gsap.to(detective, { duration: 0.5, rotation: 360, repeat: 2, ease: "power2.inOut" });
        clickCount = 0;
      }
    });
  } catch (error) {
    console.error("Lottie animasyonu başlatılırken bir hata oluştu:", error);
  }
});

async function analyzeLink() {
  const link = document.getElementById("linkInput").value.trim();
  const resultDiv = document.getElementById("result");
  const detailsButton = document.getElementById("detailsButton");
  const shareButtons = document.getElementById("shareButtons");
  const tipsDiv = document.getElementById("tips");
  const tipText = document.getElementById("tipText");
  const detective = document.getElementById("detective");

  if (!link) {
    resultDiv.innerHTML = "Lütfen bir link gir!";
    showSpeech("Hımm, bir link girmen lazım ki inceleyeyim!");
    return;
  }

  resultDiv.innerHTML = "Dedektif Linko analiz ediyor... 🔍";
  showSpeech("Hemen bakıyorum, biraz sabır!");
  gsap.to(resultDiv, { duration: 0.5, scale: 1.1, yoyo: true, repeat: 3 });
  gsap.to(detective, { duration: 0.5, x: 20, yoyo: true, repeat: 3 });
  sounds.scan.play();

  if (window.blacklist && window.blacklist.includes(link)) {
    setTimeout(() => {
      resultDiv.innerHTML = "🚨 Tehlikeli! Bu bir phishing sitesi olabilir.";
      resultDiv.style.color = "red";
      showSpeech("Aman dikkat! Bu sahte bir site, tıklamayasın!");
      sounds.alert.play();
      lastResult = "Dedektif Linko bu linki tehlikeli buldu! 🚨";
      detailsButton.classList.remove("hidden");
      shareButtons.classList.remove("hidden");
      updateScore();
      showTip("Bu URL, bilinen bir phishing listesinde bulundu. Tıklamadan önce dikkatli ol!");
      showDetails(["Bu URL, sahte siteler listesinde bulundu."]);
      gsap.from(resultDiv, { duration: 1, scale: 1.2, ease: "bounce" });
      scrollToResult();
    }, 2000);
    return;
  }

  if (window.whitelist && window.whitelist.includes(link)) {
    setTimeout(() => {
      resultDiv.innerHTML = "✅ Güvenli! Resmi bir site.";
      resultDiv.style.color = "green";
      showSpeech("Harika! Bu resmi bir site, rahatça kullanabilirsin!");
      sounds.success.play();
      lastResult = "Dedektif Linko bu linki güvenli buldu! ✅";
      detailsButton.classList.remove("hidden");
      shareButtons.classList.remove("hidden");
      updateScore();
      showTip("Bu site resmi bir domain, güvenle kullanabilirsin!");
      showDetails(["Bu URL, güvenli siteler listesinde bulundu."]);
      gsap.from(resultDiv, { duration: 1, scale: 1.2, ease: "bounce" });
      scrollToResult();
    }, 2000);
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
    const data = await response.json();

    setTimeout(() => {
      let tip;
      if (data.status === "safe") {
        resultDiv.innerHTML = "Bağlantı güvenli ama bilmediğin bağlantılara tıklarken dikkatli ol.";
        resultDiv.style.color = "green";
        tip = "Güvenli linkler genelde 'https' ile başlar. Yine de dikkatli ol!";
        showSpeech("Bağlantı güvenli, ama bilmediğin linklere dikkat et!");
        sounds.success.play();
        lastResult = "Dedektif Linko bu linki güvenli buldu! ✅";
        gsap.to(detective, { duration: 1, y: -50, ease: "bounce" });
      } else if (data.status === "suspicious") {
        resultDiv.innerHTML = "⚠️ Dikkat! Bu link şüpheli olabilir.";
        resultDiv.style.color = "orange";
        tip = "Linkte garip kelimeler veya yazım hataları var mı? Dikkatli ol!";
        showSpeech("Hımm, bu biraz şüpheli görünüyor. Detaylara bakalım!");
        sounds.hmm.play();
        lastResult = "Dedektif Linko bu linki şüpheli buldu! ⚠️";
        gsap.to(detective, { duration: 0.5, rotation: 10, yoyo: true, repeat: 2 });
      } else {
        resultDiv.innerHTML = "🚨 Tehlikeli! Sakın tıklamayasın!";
        resultDiv.style.color = "red";
        tip = "Bilinmeyen domain’lere tıklamadan önce iki kere düşün!";
        showSpeech("Aman dikkat! Bu link tehlikeli, sakın tıklamayasın!");
        sounds.alert.play();
        lastResult = "Dedektif Linko bu linki tehlikeli buldu! 🚨";
        gsap.to(detective, { duration: 0.3, x: -50, repeat: 2, yoyo: true });
      }

      detailsButton.classList.remove("hidden");
      shareButtons.classList.remove("hidden");
      updateScore();
      showTip(tip);
      showDetails(data.details);
      gsap.from(resultDiv, { duration: 1, scale: 1.2, ease: "bounce" });
      scrollToResult();

      fetchWhoisInfo(link);
    }, 2000);
  } catch (error) {
    resultDiv.innerHTML = "Bir hata oluştu, tekrar dene!";
    showSpeech("Eyvah! Bir şeyler ters gitti, tekrar dene!");
    console.error(error);
  }
}

async function fetchWhoisInfo(link) {
  try {
    const response = await fetch("http://localhost:3000/whois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
    const whoisData = await response.json();

    const whoisList = document.getElementById('whoisList');
    whoisList.innerHTML = '';

    if (whoisData.status === 'success') {
      const data = whoisData.data;
      const whoisInfo = [
        `Sahip: ${data.owner}`,
        `E-posta: ${data.email}`,
        `Kayıt Tarihi: ${data.createdDate}`,
        `Son Kullanma Tarihi: ${data.expiresDate}`,
        `Kayıt Şirketi: ${data.registrar}`,
      ];

      whoisInfo.forEach(info => {
        const li = document.createElement('li');
        li.innerText = info;
        whoisList.appendChild(li);
      });

      document.getElementById('whoisPanel').classList.remove('hidden');
      gsap.from("#whoisPanel", { duration: 0.5, opacity: 0, y: 20, ease: "power2.out" });
    } else {
      const li = document.createElement('li');
      li.innerText = whoisData.message || 'WHOIS bilgileri alınamadı.';
      whoisList.appendChild(li);
      document.getElementById('whoisPanel').classList.remove('hidden');
      gsap.from("#whoisPanel", { duration: 0.5, opacity: 0, y: 20, ease: "power2.out" });
    }
    scrollToResult();
  } catch (error) {
    console.error('WHOIS sorgu hatası:', error);
    const whoisList = document.getElementById('whoisList');
    whoisList.innerHTML = '';
    const li = document.createElement('li');
    li.innerText = 'WHOIS bilgileri alınırken bir hata oluştu.';
    whoisList.appendChild(li);
    document.getElementById('whoisPanel').classList.remove('hidden');
    gsap.from("#whoisPanel", { duration: 0.5, opacity: 0, y: 20, ease: "power2.out" });
    scrollToResult();
  }
}

function scrollToResult() {
  const resultDiv = document.getElementById("result");
  if (resultDiv) {
    resultDiv.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    window.scrollBy(0, -50);
  }
}

function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("dark-mode", isDarkMode);
  document.querySelector(".container").classList.toggle("dark-mode", isDarkMode);
  document.querySelectorAll("h1, p, input, button, #speechText, #detailsPanel h3, #detailsList li, #whoisPanel h3, #whoisList li, #scoreBoard, #tips, #speechBubble, #detailsButton, .share-btn").forEach(element => {
    element.classList.toggle("dark-mode", isDarkMode);
  });
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.textContent = isDarkMode ? "☀️" : "🌙";
  }
}

function shareOnTwitter() {
  const text = encodeURIComponent(`${lastResult} Sen de linklerini kontrol et: ${window.location.href}`);
  window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
}

function shareOnWhatsApp() {
  const text = encodeURIComponent(`${lastResult} Sen de linklerini kontrol et: ${window.location.href}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
}

function showSpeech(text) {
  const speechBubble = document.getElementById("speechBubble");
  const speechText = document.getElementById("speechText");
  speechText.innerHTML = text;
  speechBubble.classList.remove("hidden");
  gsap.from(speechBubble, { duration: 0.5, opacity: 0, y: 20, ease: "power2.out" });
}

function showDetails(details) {
  const detailsList = document.getElementById("detailsList");
  detailsList.innerHTML = "";
  details.forEach((detail) => {
    const li = document.createElement("li");
    li.innerHTML = detail;
    detailsList.appendChild(li);
  });
}

function toggleDetails() {
  const detailsPanel = document.getElementById("detailsPanel");
  const detailsButton = document.getElementById("detailsButton");
  if (detailsPanel.classList.contains("hidden")) {
    detailsPanel.classList.remove("hidden");
    detailsButton.innerHTML = "Detayları Gizle";
    gsap.from(detailsPanel, { duration: 0.5, opacity: 0, y: 20, ease: "power2.out" });
  } else {
    detailsPanel.classList.add("hidden");
    detailsButton.innerHTML = "Detayları Gör";
  }
}

function showTip(tip) {
  const tipsDiv = document.getElementById("tips");
  const tipText = document.getElementById("tipText");
  tipText.innerHTML = tip;
  tipsDiv.classList.remove("hidden");
  gsap.from(tipsDiv, { duration: 1, opacity: 0, y: 20, ease: "power2.out" });
}

function updateScore() {
  score += 10;
  document.getElementById("score").innerHTML = score;
  if (score >= 50 && score < 100) badge = "Usta Dedektif";
  else if (score >= 100) badge = "Siber Kahraman";
  document.getElementById("badge").innerHTML = badge;
  gsap.from("#scoreBoard", { duration: 0.5, scale: 1.2, ease: "bounce" });
}