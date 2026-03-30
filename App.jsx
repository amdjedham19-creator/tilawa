import React, { useState, useEffect, useRef } from 'react';

// دالة تنظيف النص للمقارنة
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
  const [loading, setLoading] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef(null);
  const wordsRef = useRef([]); 
  const currentIndexRef = useRef(0);

  // جلب السور
  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah")
      .then(res => res.json())
      .then(data => setSurahs(data.data));
  }, []);

  // جلب آيات السورة وتنسيقها
  useEffect(() => {
    setLoading(true);
    if (recognitionRef.current) recognitionRef.current.stop();
    
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        let tempWords = [];
        data.data.ayahs.forEach((ayah) => {
          let text = ayah.text;
          if (ayah.numberInSurah === 1 && selectedSurah != 1 && selectedSurah != 9) {
            text = text.replace("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ", "");
          }
          const words = text.split(/\s+/).filter(w => w.length > 0);
          words.forEach((w, i) => {
            tempWords.push({
              original: w,
              normalized: normalizeArabic(w),
              id: `w-${ayah.number}-${i}`
            });
          });
        });
        wordsRef.current = tempWords;
        setRevealedCount(0);
        currentIndexRef.current = 0;
        setLoading(false);
      });
  }, [selectedSurah]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("المتصفح لا يدعم الصوت");

    const recognition = new SR();
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
              if (normalizeArabic(spoken) === wordsRef.current[latestIdx].normalized) {
                latestIdx++;
              }
            }
          });
          currentIndexRef.current = latestIdx;
          setRevealedCount(latestIdx);
        }
      }
    };
    recognition.onend = () => {
      if (isListening) recognition.start(); // إعادة تشغيل تلقائي
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#fdfcf0', padding: '20px', fontFamily: 'serif' }}>
      
      {/* منطقة التحكم */}
      <div style={{ maxWidth: '600px', margin: '0 auto 20px', textAlign: 'center' }}>
        <select 
          value={selectedSurah} 
          onChange={(e) => setSelectedSurah(Number(e.target.value))}
          style={{ width: '100%', padding: '15px', borderRadius: '12px', fontSize: '18px', border: '2px solid #2d6a4f', marginBottom: '15px' }}
        >
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>

        <button 
          onClick={isListening ? stopListening : startListening} 
          style={{
            width: '100%', padding: '15px', borderRadius: '50px', 
            backgroundColor: isListening ? '#d90429' : '#2d6a4f',
            color: 'white', border: 'none', fontSize: '18px', fontWeight: 'bold'
          }}
        >
          {isListening ? '⏹ إيقاف' : '🎤 ابدأ التسميع'}
        </button>
      </div>

      {/* منطقة المصحف - تم إصلاح مشكلة السطر الواحد هنا */}
      <div style={{ 
        maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '30px', 
        borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        minHeight: '400px', borderRight: '10px solid #2d6a4f'
      }}>
        {loading ? (
          <p style={{ textAlign: 'center' }}>جاري التحميل...</p>
        ) : (
          <div style={{ 
            fontSize: '32px', 
            lineHeight: '2', 
            textAlign: 'justify', // توزيع الكلمات على الأسطر
            display: 'block', // ضمان أنها فقرة واحدة
            whiteSpace: 'normal', // السماح بالانتقال لسطر جديد
            wordWrap: 'break-word' 
          }}>
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ textAlign: 'center', color: '#2d6a4f', marginBottom: '20px', fontSize: '26px' }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </div>
            )}
            
            {wordsRef.current.map((word, idx) => (
              <span key={word.id} style={{ 
                color: idx < revealedCount ? '#2d6a4f' : (isListening ? '#eee' : '#1a1a1a'),
                margin: '0 4px', 
                transition: '0.3s',
                fontWeight: idx < revealedCount ? 'bold' : 'normal',
                display: 'inline' // مهم جداً لضمان عدم كسر السطر بشكل خاطئ
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
