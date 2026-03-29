import React, { useState, useEffect, useRef, useMemo } from 'react';

// دالة تنظيف النص للمقارنة الذكية (تجاهل الحركات واختلاف الألفات)
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

  // جلب قائمة السور عند التشغيل
  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah")
      .then(res => res.json())
      .then(data => setSurahs(data.data))
      .catch(err => console.error("Error fetching surahs", err));
  }, []);

  // جلب آيات السورة المختارة
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

  // تجهيز الكلمات ومعالجة البسملة
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
    if (!SR) return alert("متصفحك لا يدعم التعرف على الصوت");
    const r = new SR();
    r.lang = 'ar-SA';
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const spokenWords = e.results[i][0].transcript.trim().split(/\s+/);
          let currentIdx = progressRef.current.idx;

          for (const spoken of spokenWords) {
            if (currentIdx >= wordList.length) break;
            if (normalizeArabic(spoken) === wordList[currentIdx].normalized) {
              currentIdx++;
              setRevealedCount(currentIdx);
              progressRef.current.idx = currentIdx;
              setErrorInfo(null);
            } else {
              setErrorInfo({ spoken, expected: wordList[currentIdx].original });
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

  const progress = wordList.length > 0 ? Math.round((revealedCount / wordList.length) * 100) : 0;

  return (
    <div dir="rtl" style={{ 
      minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px', 
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' 
    }}>
      {/* الرأس - Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#0f172a', fontSize: '24px', fontWeight: '800' }}>مُصحح التلاوة الذكي</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>اختبر حفظك من خلال التلاوة المباشرة</p>
      </div>

      {/* اختيار السورة */}
      <div style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
        <select 
          value={selectedSurah} 
          onChange={(e) => setSelectedSurah(e.target.value)}
          style={{ 
            width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #e2e8f0',
            fontSize: '18px', appearance: 'none', backgroundColor: 'white', cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        >
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>
      </div>

      {/* شريط التقدم */}
      <div style={{ maxWidth: '500px', margin: '0 auto 25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
          <span>إنجازك: {progress}%</span>
          <span>{revealedCount} / {wordList.length} كلمة</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease' }}></div>
        </div>
      </div>

      {/* التحكم - Buttons */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button 
          onClick={isListening ? () => recRef.current.stop() : startListening} 
          style={{
            padding: '16px 40px', borderRadius: '50px', fontSize: '18px', fontWeight: 'bold',
            border: 'none', color: 'white', cursor: 'pointer', transition: '0.3s',
            backgroundColor: isListening ? '#ef4444' : '#059669',
            boxShadow: isListening ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 4px 14px rgba(5, 150, 105, 0.3)'
          }}
        >
          {isListening ? '⏹ إيقاف التسميع' : '🎤 ابدأ التلاوة الآن'}
        </button>
      </div>

      {/* عرض الخطأ */}
      {errorInfo && (
        <div style={{ 
          maxWidth: '500px', margin: '0 auto 20px', padding: '12px', borderRadius: '12px', 
          backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', textAlign: 'center'
        }}>
          قلت: "<strong>{errorInfo.spoken}</strong>" • الصواب: "<strong>{errorInfo.expected}</strong>"
        </div>
      )}

      {/* لوحة المصحف */}
      <div style={{ 
        maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '40px', 
        borderRadius: '24px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', minHeight: '300px'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b' }}>جاري تحميل الآيات...</div>
        ) : (
          <div style={{ 
            fontSize: '28px', lineHeight: '2.5', textAlign: 'center', fontWeight: '500', 
            fontFamily: '"Amiri", serif' 
          }}>
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ color: '#94a3b8', fontSize: '20px', marginBottom: '20px' }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
            )}
            {wordList.map((word, idx) => {
              const isRevealed = !isListening || idx < revealedCount;
              return (
                <span key={word.id} style={{ 
                  color: idx < revealedCount ? '#059669' : (isListening ? '#e2e8f0' : '#1e293b'),
                  margin: '0 4px', transition: 'color 0.4s ease'
                }}>
                  {isRevealed ? word.original : '...'}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
