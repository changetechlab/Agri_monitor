/**
 * Agri Monitor — js/weather.js
 * ─────────────────────────────────────────────────────────────
 * Purpose  : Localized weather predictions & mountain disaster alerts.
 *            Updates dynamically based on selected district.
 * Depends  : Exposes window.AgriWeather
 */

window.AgriWeather = (() => {

  // Mountain district localized simulated live weather & disaster warnings
  const WEATHER_DATA = {
    rudraprayag: {
      temp: '18°C',
      humidity: '78%',
      rain: '65%',
      condition: '🌧️ हल्की बारिश',
      alert: '⚠️ केदारनाथ मार्ग पर भूस्खलन (Landslide) का मध्यम खतरा — ऊंचाई वाले खेतों में जलभराव रोकें।'
    },
    chamoli: {
      temp: '12°C',
      humidity: '88%',
      rain: '92%',
      condition: '⛈️ भारी आंधी',
      alert: '⚠️ चमोली के पहाड़ी ढलानों पर भूस्खलन और बिजली गिरने की चेतावनी। मवेशियों को बाड़े में सुरक्षित रखें।'
    },
    tehri: {
      temp: '22°C',
      humidity: '52%',
      rain: '12%',
      condition: '🌤️ सुहावना मौसम',
      alert: '🌾 मौसम अनुकूल है। सिंचाई के लिए प्राकृतिक जल स्रोतों (स्प्रिंगवेड) के जल का संचय करें।'
    },
    uttarkashi: {
      temp: '14°C',
      humidity: '82%',
      rain: '75%',
      condition: '🌧️ भारी वर्षा',
      alert: '⚠️ यमुनोत्री घाटी में बादल फटने (Cloudburst) की आशंका — निचले खेतों से मवेशियों को सुरक्षित स्थानों पर ले जाएं।'
    },
    almora: {
      temp: '23°C',
      humidity: '48%',
      rain: '8%',
      condition: '☀️ धूप खिली है',
      alert: '🌾 बढ़ते तापमान से कीटों का खतरा बढ़ सकता है। जैविक कीटनाशकों का सुबह के समय छिड़काव करें।'
    },
    pithoragarh: {
      temp: '15°C',
      humidity: '72%',
      rain: '55%',
      condition: '🌧️ गरज के साथ बौछारें',
      alert: '⚠️ दारमा घाटी में आकाशीय बिजली चमकने की आशंका। तेज हवाओं से पॉलीहाउस के द्वारों को बंद रखें।'
    },
    pauri: {
      temp: '20°C',
      humidity: '58%',
      rain: '22%',
      condition: '🌤️ आंशिक बादल',
      alert: '🌾 अदरक और हल्दी की बुवाई के लिए मौसम अनुकूल है। खेतों के मेड़ों की जल निकासी ठीक करें।'
    },
    all: {
      temp: '17°C',
      humidity: '68%',
      rain: '45%',
      condition: '🌦️ मिश्रित मौसम',
      alert: '🌾 पहाड़ी क्षेत्रों में कृषि कार्यों के दौरान स्थानीय मौसम विभाग की चेतावनियों पर ध्यान दें।'
    }
  };

  // ============================================================
  // Initialize weather widget
  // ============================================================
  function init() {
    updateWeather('rudraprayag'); // Default district on boot
    bindEvents();
    console.log('[Weather] Live disaster warning system initialized.');
  }

  // ============================================================
  // Update UI values dynamically
  // ============================================================
  function updateWeather(districtId) {
    const data = WEATHER_DATA[districtId] || WEATHER_DATA.all;
    
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const condEl = document.getElementById('weather-cond');
    const humidityEl = document.getElementById('weather-humidity');
    const rainEl = document.getElementById('weather-rain');
    const alertEl = document.getElementById('weather-alert-text');

    // Extract condition icon
    const icon = data.condition.split(' ')[0] || '🌦️';
    const condText = data.condition.substring(icon.length).trim();

    if (iconEl) iconEl.textContent = icon;
    if (tempEl) tempEl.textContent = data.temp;
    if (condEl) condEl.textContent = condText;
    if (humidityEl) humidityEl.textContent = data.humidity;
    if (rainEl) rainEl.textContent = data.rain;
    
    if (alertEl) {
      alertEl.textContent = data.alert;
      // Reset animation on content update
      alertEl.style.animation = 'none';
      alertEl.offsetHeight; /* trigger reflow */
      alertEl.style.animation = '';
    }
  }

  // ============================================================
  // Bind change triggers
  // ============================================================
  function bindEvents() {
    const selector = document.getElementById('district-select');
    if (selector) {
      selector.addEventListener('change', (e) => {
        updateWeather(e.target.value);
      });
    }
  }

  return {
    init,
    updateWeather
  };
})();
