import React, { useState, useEffect, useRef, useCallback } from 'react';

// دالة تنظيف النص للمقارنة الذكية
const normalizeArabic = (text) => {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "") 
    .replace(/[أإآء]/g, "ا")             
    .replace(/ة/g, "ه")                
    .replace(/ى/g, "ي")                
    .trim();
};

export default function App() {
  const [surahs, setSurahs] = useState([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef(null);
  const wordsRef = useRef([]); // مرجع للكلمات لتجنب مشاكل التحديث
  const currentIndexRef = useRef(0);

  // 1. جلب قائمة السور
  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah")
      .then(res => res.json())
      .then(data => setSurahs(data.data))
      .catch(err => console.error("Error fetching surahs", err));
  }, []);

  // 2. جلب آيات السورة وتجهيز الكلمات
  useEffect(() => {
    setLoading(true);
    stopListening(); // إيقاف الميكروفون عند تغيير السورة
    
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        const allAyahs = data.data.ayahs;
        let tempWords = [];
        
        allAyahs.forEach((ayah) => {
          let text = ayah.text;
          // إزالة البسملة من بداية السور (عدا الفاتحة والتوبة)
          if (ayah.numberInSurah === 1 && selectedSurah != 1 && selectedSurah != 9) {
            text = text.replace("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ", "");
          }
          const words = text.split(/\s+/).filter(w => w.length > 0);
          words.forEach((w, i) => {
            tempWords.push({
              original: w,
              normalized: normalizeArabic(w),
              id: `${ayah.number}-${i}`
            });
          });
        });

        wordsRef.current = tempWords;
        setAyahs(allAyahs);
        setRevealedCount(0);
        currentIndexRef.current = 0;
        setLoading(false);
      });
  }, [selectedSurah]);

  // 3. دالة تشغيل الميكروفون (المحرك الأساسي)
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("عذراً، متصفحك لا يدعم خاصية التعرف على الصوت.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      let latestIdx = currentIndexRef.current;
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const spokenText = event.results[i][0].transcript.trim().split(/\s+/);
          
          spokenText.forEach(spoken => {
            if (latestIdx < wordsRef.current.length) {
              const target = wordsRef.current[latestIdx].normalized;
              const input = normalizeArabic(spoken);
              
              if (input === target) {
                latestIdx++;
              }
            }
          });
          
          currentIndexRef.current = latestIdx;
          setRevealedCount(latestIdx);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("SR Error:", event.error);
      if (event.error === 'not-allowed') alert("يرجى السماح بالوصول للميكروفون.");
    };

    recognition.onend = () => {
      // إعادة التشغيل التلقائي إذا كان المستخدم لم يضغط "إيقاف"
      if (recognitionRef.current === recognition && currentIndexRef.current < wordsRef.current.length) {
         try { recognition.start(); } catch(e) {}
      } else {
         setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#f4f1ea', padding: '20px 10px', fontFamily: 'serif' }}>
      
      {/* الواجهة العلوية */}
      <div style={{ maxWidth: '600px', margin: '0 auto 20px', backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#1b4332' }}>مُصحح التلاوة</h2>
        
        <select 
          value={selectedSurah} 
          onChange={(e) => setSelectedSurah(parseInt(e.target.value))}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '15px', fontSize: '16px' }}
        >
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>

        <button 
          onClick={isListening ? stopListening : startListening} 
          style={{
            width: '100%', padding: '15px', borderRadius: '50px', 
            backgroundColor: isListening ? '#bc4749' : '#2d6a4f',
            color: 'white', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          {isListening ? '⏹ إيقاف التسميع' : '🎤 ابدأ التسميع'}
        </button>
      </div>

      {/* منطقة عرض السورة */}
      <div style={{ 
        maxWidth: '800px', margin: '0 auto', backgroundColor: '#fffcf2', padding: '35px 20px', 
        borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.05)', borderRight: '8px solid #2d6a4f',
        minHeight: '400px'
      }}>
        {loading ? (
          <p style={{ textAlign: 'center' }}>جاري فتح المصحف...</p>
        ) : (
          <div style={{ fontSize: '30px', lineHeight: '2.3', textAlign: 'justify', direction: 'rtl' }}>
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ textAlign: 'center', color: '#2d6a4f', marginBottom: '20px', fontSize: '24px' }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
            )}
            
            {wordsRef.current.map((word, idx) => (
              <span key={word.id} style={{ 
                color: idx < revealedCount ? '#2d6a4f' : (isListening ? '#e9e4d4' : '#1a1a1a'),
                margin: '0 4px', transition: 'color 0.3s',
                fontWeight: idx < revealedCount ? 'bold' : 'normal'
              }}>
                {(!isListening || idx < revealedCount) ? word.original : '••••'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
