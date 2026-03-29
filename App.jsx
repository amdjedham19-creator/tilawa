import React, { useState, useEffect, useRef, useMemo } from 'react';

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
  const [errorInfo, setErrorInfo] = useState(null);
  const progressRef = useRef({ idx: 0 });
  const recRef = useRef(null);

  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah")
      .then(res => res.json())
      .then(data => setSurahs(data.data))
      .catch(err => console.error("Error", err));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        setAyahs(data.data.ayahs);
        setRevealedCount(0);
        progressRef.current.idx = 0;
        setErrorInfo(null);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, [selectedSurah]);

  const wordList = useMemo(() => {
    let arr = [];
    ayahs.forEach((ayah) => {
      let text = ayah.text;
      if (ayah.numberInSurah === 1 && selectedSurah !== 1 && selectedSurah !== 9) {
        text = text.replace("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ", "");
      }
      const words = text.split(/\s+/);
      words.forEach((t, i) => {
        if (t) arr.push({
          original: t,
          normalized: normalizeArabic(t),
          id: `${ayah.number}-${i}`
        });
      });
    });
    return arr;
  }, [ayahs, selectedSurah]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("المتصفح لا يدعم الصوت");
    const r = new SR();
    r.lang = 'ar-SA';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const spokenWords = e.results[i][0].transcript.trim().split(/\s+/);
          let currentIdx = progressRef.current.idx;
          for (const spoken of spokenWords) {
            if (currentIdx < wordList.length && normalizeArabic(spoken) === wordList[currentIdx].normalized) {
              currentIdx++;
              setRevealedCount(currentIdx);
              progressRef.current.idx = currentIdx;
            }
          }
        }
      }
    };
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    recRef.current = r;
    r.start();
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#fcfaf5', padding: '15px', fontFamily: 'serif' }}>
      
      {/* Header & Selector */}
      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: '#2d6a4f', marginBottom: '15px' }}>مُصحح التلاوة</h2>
        <select 
          value={selectedSurah} 
          onChange={(e) => setSelectedSurah(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '18px', border: '2px solid #2d6a4f', marginBottom: '15px' }}
        >
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>

        <button 
          onClick={isListening ? () => recRef.current.stop() : startListening} 
          style={{
            width: '100%', padding: '15px', borderRadius: '50px', backgroundColor: isListening ? '#e63946' : '#2d6a4f',
            color: 'white', border: 'none', fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', cursor: 'pointer'
          }}
        >
          {isListening ? '⏹ إيقاف' : '🎤 ابدأ التسميع'}
        </button>
      </div>

      {/* منطقة المصحف المطورة */}
      <div style={{ 
        maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '30px', 
        borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        border: '1px solid #eee'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>جاري التحميل...</div>
        ) : (
          <div style={{ 
            fontSize: '32px', // خط كبير وواضح
            lineHeight: '2.2', // مسافة مريحة بين الأسطر
            textAlign: 'justify', // توزيع الكلمات في الأسطر بشكل متناسق
            direction: 'rtl',
            color: '#1a1a1a',
            wordSpacing: '2px' // مسافة بين الكلمات لمنع التداخل
          }}>
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ textAlign: 'center', color: '#888', fontSize: '22px', marginBottom: '15px' }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </div>
            )}
            
            {/* عرض الكلمات في شكل فقرة متصلة (أسطر تلقائية) */}
            <div style={{ display: 'inline-block', width: '100%' }}>
              {wordList.map((word, idx) => (
                <span key={word.id} style={{ 
                  color: idx < revealedCount ? '#10b981' : (isListening ? '#eee' : '#1a1a1a'),
                  backgroundColor: (isListening && idx >= revealedCount) ? '#f9f9f9' : 'transparent',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  transition: '0.3s'
                }}>
                  {(isListening && idx >= revealedCount) ? '...' : word.original}
                  {' '} {/* مسافة حقيقية بين الكلمات */}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '12px' }}>
        * الكلمات ستختفي وتظهر سطر بسطر عند التسميع الصحيح
      </p>
    </div>
  );
}

