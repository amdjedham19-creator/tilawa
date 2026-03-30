import React, { useState, useEffect, useRef } from 'react';

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

  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah").then(res => res.json()).then(data => setSurahs(data.data));
  }, []);

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
    recognition.onend = () => { if (isListening) recognition.start(); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#f4f1ea', padding: '20px' }}>
      
      {/* ستايل خط الأميري والتنسيق */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
          .quran-container {
            max-width: 850px;
            margin: 0 auto;
            background-color: #fffcf2;
            padding: 40px 25px;
            border-radius: 8px;
            box-shadow: 0 0 30px rgba(0,0,0,0.05);
            border-right: 12px solid #2d6a4f; /* الحاشية الخضراء */
            min-height: 450px;
          }
          .quran-text {
            font-family: 'Amiri', serif;
            font-size: 34px;
            line-height: 2.3;
            text-align: justify;
            color: #1a1a1a;
          }
        `}
      </style>

      {/* لوحة التحكم */}
      <div style={{ maxWidth: '600px', margin: '0 auto 25px', backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#1b4332', fontFamily: "'Amiri', serif" }}>مُصحح التلاوة</h2>
        <select 
          value={selectedSurah} 
          onChange={(e) => setSelectedSurah(Number(e.target.value))}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '18px', border: '2px solid #b7ad94', marginBottom: '15px' }}
        >
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>
        <button 
          onClick={isListening ? stopListening : startListening} 
          style={{
            width: '100%', padding: '15px', borderRadius: '50px', 
            backgroundColor: isListening ? '#bc4749' : '#2d6a4f',
            color: 'white', border: 'none', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          {isListening ? '⏹ إيقاف التسميع' : '🎤 ابدأ التسميع'}
        </button>
      </div>

      {/* عرض الصفحة */}
      <div className="quran-container">
        {loading ? (
          <p style={{ textAlign: 'center', fontFamily: 'serif' }}>جاري فتح المصحف...</p>
        ) : (
          <div className="quran-text">
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ textAlign: 'center', color: '#2d6a4f', marginBottom: '25px', fontSize: '28px' }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </div>
            )}
            
            <div style={{ display: 'inline' }}>
              {wordsRef.current.map((word, idx) => (
                <span key={word.id} style={{ 
                  color: idx < revealedCount ? '#2d6a4f' : (isListening ? '#e9e4d4' : '#1a1a1a'),
                  margin: '0 2px', 
                  transition: 'all 0.4s ease',
                  fontWeight: idx < revealedCount ? '700' : '400',
                  display: 'inline'
                }}>
                  {(!isListening || idx < revealedCount) ? word.original : '••••'}
                  {' '}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
