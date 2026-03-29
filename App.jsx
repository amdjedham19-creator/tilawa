import React, { useState, useEffect, useRef, useMemo } from 'react';

// دالة التنظيف (للاستخدام غداً)
const normalizeArabic = (text) => {
  if (!text) return "";
  return text.replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآء]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
};

export default function App() {
  const [surahs, setSurahs] = useState([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const progressRef = useRef({ idx: 0 });
  const recRef = useRef(null);

  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah").then(res => res.json()).then(data => setSurahs(data.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        setAyahs(data.data.ayahs);
        setRevealedCount(0);
        progressRef.current.idx = 0;
        setLoading(false);
      });
  }, [selectedSurah]);

  const wordList = useMemo(() => {
    let arr = [];
    ayahs.forEach((ayah) => {
      let text = ayah.text;
      if (ayah.numberInSurah === 1 && selectedSurah !== 1 && selectedSurah !== 9) {
        text = text.replace("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ", "");
      }
      const words = text.split(/\s+/);
      words.forEach((t, i) => { if (t) arr.push({ original: t, normalized: normalizeArabic(t), id: `${ayah.number}-${i}` }); });
    });
    return arr;
  }, [ayahs, selectedSurah]);

  return (
    <div dir="rtl" style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f4f1ea', // لون ورقي هادئ
      padding: '20px 10px', 
      fontFamily: "'Amiri', serif",
      backgroundImage: 'radial-gradient(#e5e0d5 1px, transparent 1px)',
      backgroundSize: '20px 20px'
    }}>
      
      {/* Header Card */}
      <div style={{ 
        maxWidth: '600px', margin: '0 auto 25px', 
        backgroundColor: '#fff', padding: '20px', 
        borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        border: '1px solid #d4cebc'
      }}>
        <h2 style={{ color: '#1b4332', textAlign: 'center', marginTop: 0, fontSize: '28px' }}>مُصحح التلاوة</h2>
        
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <select 
            value={selectedSurah} 
            onChange={(e) => setSelectedSurah(e.target.value)}
            style={{ 
              width: '100%', padding: '15px', borderRadius: '12px', fontSize: '18px', 
              border: '2px solid #b7ad94', backgroundColor: '#fdfcf8', color: '#333',
              outline: 'none', cursor: 'pointer'
            }}
          >
            {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
          </select>
        </div>

        <button 
          onClick={() => setIsListening(!isListening)} // تجريبي للشكل اليوم
          style={{
            width: '100%', padding: '15px', borderRadius: '50px', 
            backgroundColor: isListening ? '#bc4749' : '#2d6a4f',
            color: 'white', border: 'none', fontSize: '20px', fontWeight: 'bold', 
            boxShadow: '0 5px 15px rgba(45, 106, 79, 0.3)', cursor: 'pointer'
          }}
        >
          {isListening ? '⏹ إنهاء التسميع' : '🎤 ابدأ التسميع (إخفاء)'}
        </button>
      </div>

      {/* Mushaf Page Area */}
      <div style={{ 
        maxWidth: '800px', margin: '0 auto', 
        backgroundColor: '#fffcf2', padding: '40px 25px', 
        borderRadius: '5px', boxShadow: '0 0 40px rgba(0,0,0,0.1)',
        borderLeft: '15px solid #2d6a4f', // حاشية جانبية كالمصحف
        position: 'relative',
        minHeight: '400px'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#b7ad94', fontSize: '24px' }}>جاري فتح المصحف...</div>
        ) : (
          <div style={{ 
            fontSize: '34px', lineHeight: '2.5', textAlign: 'center', color: '#1a1a1a',
            textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.05)'
          }}>
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ 
                textAlign: 'center', color: '#2d6a4f', fontSize: '26px', 
                marginBottom: '30px', borderBottom: '1px double #d4cebc', paddingBottom: '10px' 
              }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </div>
            )}
            
            <div style={{ display: 'block', textAlign: 'justify', textJustify: 'inter-word' }}>
              {wordList.map((word, idx) => {
                const isRevealed = !isListening || idx < revealedCount;
                const isCurrent = isListening && idx === revealedCount;
                
                return (
                  <span key={word.id} style={{ 
                    color: idx < revealedCount ? '#2d6a4f' : (isListening ? '#e9e4d4' : '#1a1a1a'),
                    display: 'inline-block',
                    margin: '0 3px',
                    transition: 'all 0.4s ease',
                    borderBottom: isCurrent ? '3px solid #ffd700' : 'none', // لمعة تحت الكلمة الحالية
                    fontWeight: idx < revealedCount ? 'bold' : 'normal'
                  }}>
                    {isRevealed ? word.original : '••••'}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer style={{ textAlign: 'center', marginTop: '30px', color: '#8b8372', fontSize: '14px' }}>
        صدق الله العظيم
      </footer>
    </div>
  );
}
