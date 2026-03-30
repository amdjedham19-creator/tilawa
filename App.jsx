import React, { useState, useEffect, useRef } from 'react';

// دالة المقارنة المرنة (لا تعتبر اختلاف الرسم أو التشكيل خطأ)
const normalizeArabic = (text) => {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
    .replace(/[أإآء]/g, "ا")             // توحيد الألف
    .replace(/ة/g, "ه")                // التاء المربوطة
    .replace(/ى/g, "ي")                // الألف المقصورة
    .trim();
};

export default function App() {
  const [surahs, setSurahs] = useState([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [loading, setLoading] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState(""); 
  const [errorsLog, setErrorsLog] = useState([]); 
  
  const recognitionRef = useRef(null);
  const wordsRef = useRef([]); 
  const currentIndexRef = useRef(0);

  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah").then(res => res.json()).then(data => setSurahs(data.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    setErrorsLog([]);
    setLiveTranscript("");
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
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          const spokenWords = transcript.split(/\s+/);
          let latestIdx = currentIndexRef.current;

          spokenWords.forEach(spoken => {
            if (latestIdx < wordsRef.current.length) {
              const target = wordsRef.current[latestIdx];
              if (normalizeArabic(spoken) === target.normalized) {
                latestIdx++;
              } else {
                setErrorsLog(prev => [{
                  correct: target.original,
                  said: spoken
                }, ...prev].slice(0, 3)); 
              }
            }
          });
          currentIndexRef.current = latestIdx;
          setRevealedCount(latestIdx);
        } else {
          interim = transcript;
        }
      }
      setLiveTranscript(interim);
    };

    recognition.onend = () => { if (isListening) recognition.start(); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#f4f1ea', padding: '15px', paddingBottom: '120px' }}>
      
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
          
          .quran-container { 
            max-width: 800px; 
            margin: 0 auto; 
            background-color: #fffcf2; 
            padding: 35px 20px; 
            border-radius: 8px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
            border-right: 12px solid #2d6a4f;
            display: block; /* ضمان الحاوية كفقرة */
          }

          .quran-text { 
            font-family: 'Amiri', serif; 
            font-size: 32px; 
            line-height: 2.3; 
            text-align: justify; 
            color: #1a1a1a;
            white-space: normal; /* السماح بالانتقال التلقائي للسطر التالي */
            word-wrap: break-word;
            display: block;
          }

          .word-span {
            display: inline; /* الكلمة جزء من النص وليست بلوك مستقل */
            margin: 0 2px;
            transition: color 0.3s ease;
          }

          .live-bar { 
            position: fixed; bottom: 0; left: 0; right: 0; 
            background: #2d6a4f; color: white; padding: 15px; 
            text-align: center; font-weight: bold; z-index: 1000;
          }
        `}
      </style>

      {/* لوحة التحكم */}
      <div style={{ maxWidth: '600px', margin: '0 auto 20px', backgroundColor: '#fff', padding: '15px', borderRadius: '15px' }}>
        <h3 style={{ textAlign: 'center', color: '#1b4332', fontFamily: "'Amiri', serif", marginTop: 0 }}>مُصحح التلاوة</h3>
        <select value={selectedSurah} onChange={(e) => setSelectedSurah(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '10px', fontSize: '16px' }}>
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>
        <button onClick={isListening ? () => setIsListening(false) : startListening} style={{ width: '100%', padding: '15px', borderRadius: '50px', backgroundColor: isListening ? '#bc4749' : '#2d6a4f', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '18px' }}>
          {isListening ? '⏹ إيقاف التسميع' : '🎤 ابدأ التسميع'}
        </button>
      </div>

      {/* منطقة المصحف - تم تثبيت الأسطر هنا */}
      <div className="quran-container">
        {loading ? <p style={{ textAlign: 'center' }}>جاري فتح المصحف...</p> : (
          <div className="quran-text">
            {selectedSurah != 1 && selectedSurah != 9 && (
              <div style={{ textAlign: 'center', color: '#2d6a4f', marginBottom: '20px' }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
            )}
            
            {wordsRef.current.map((word, idx) => (
              <span key={word.id} className="word-span" style={{ 
                color: idx < revealedCount ? '#2d6a4f' : (isListening ? '#eee' : '#1a1a1a'),
                fontWeight: idx < revealedCount ? '700' : '400'
              }}>
                {(!isListening || idx < revealedCount) ? word.original : '••••'}
                {' '}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* سجل الأخطاء */}
      {errorsLog.length > 0 && (
        <div style={{ maxWidth: '800px', margin: '20px auto', padding: '0 10px' }}>
          <p style={{ color: '#bc4749', fontWeight: 'bold', marginBottom: '5px' }}>⚠️ تصحيح مباشر:</p>
          {errorsLog.map((err, i) => (
            <div key={i} style={{ background: '#fff', borderRight: '5px solid #fda4af', padding: '10px', borderRadius: '5px', marginBottom: '5px', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
               أنت قلت: <span style={{ color: '#bc4749' }}>{err.said}</span> | الصحيح: <strong style={{ color: '#2d6a4f' }}>{err.correct}</strong>
            </div>
          ))}
        </div>
      )}

      {/* شريط الاستماع السفلي */}
      {isListening && (
        <div className="live-bar">
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '5px' }}>صوتك الآن:</div>
          <div>{liveTranscript || "تحدث الآن..."}</div>
        </div>
      )}
    </div>
  );
}
