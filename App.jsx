import React, { useState, useEffect, useRef } from 'react';

// دالة المقارنة المرنة (تتجاهل رسم الهمزة والتاء المربوطة والتشكيل)
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
  const [liveTranscript, setLiveTranscript] = useState(""); // خانة ما أقوله الآن
  const [errorsLog, setErrorsLog] = useState([]); // سجل الأخطاء (الكلمة الصحيحة ضد ما قيل)
  
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
                // إذا نطق كلمة لا تطابق الكلمة التالية في المصحف، نسجلها كخطأ
                setErrorsLog(prev => [{
                  correct: target.original,
                  said: spoken,
                  time: new Date().toLocaleTimeString('ar-DZ')
                }, ...prev].slice(0, 5)); // نحتفظ بآخر 5 أخطاء فقط
              }
            }
          });
          currentIndexRef.current = latestIdx;
          setRevealedCount(latestIdx);
        } else {
          interim += transcript;
        }
      }
      setLiveTranscript(interim || "جاري الاستماع...");
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
    <div dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#f4f1ea', padding: '10px', paddingBottom: '100px' }}>
      
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
          .quran-container { max-width: 850px; margin: 0 auto; background-color: #fffcf2; padding: 30px 20px; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.05); border-right: 10px solid #2d6a4f; min-height: 350px; }
          .quran-text { font-family: 'Amiri', serif; font-size: 30px; lineHeight: 2.2; textAlign: justify; color: #1a1a1a; }
          .error-box { background: #fff1f2; border: 1px solid #fda4af; padding: 10px; border-radius: 8px; margin-top: 15px; font-size: 14px; }
          .live-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #2d6a4f; color: white; padding: 15px; text-align: center; font-weight: bold; z-index: 1000; box-shadow: 0 -2px 10px rgba(0,0,0,0.2); }
        `}
      </style>

      {/* التحكم */}
      <div style={{ maxWidth: '600px', margin: '0 auto 15px', backgroundColor: '#fff', padding: '15px', borderRadius: '15px' }}>
        <h3 style={{ textAlign: 'center', color: '#1b4332', marginTop: 0 }}>مُصحح التلاوة</h3>
        <select value={selectedSurah} onChange={(e) => setSelectedSurah(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
          {surahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
        </select>
        <button onClick={isListening ? stopListening : startListening} style={{ width: '100%', padding: '12px', borderRadius: '50px', backgroundColor: isListening ? '#bc4749' : '#2d6a4f', color: 'white', border: 'none', fontWeight: 'bold' }}>
          {isListening ? '⏹ إيقاف' : '🎤 ابدأ التسميع'}
        </button>
      </div>

      {/* عرض المصحف */}
      <div className="quran-container">
        {loading ? <p style={{ textAlign: 'center' }}>جاري التحميل...</p> : (
          <div className="quran-text">
            {selectedSurah != 1 && selectedSurah != 9 && <div style={{ textAlign: 'center', color: '#2d6a4f', fontSize: '24px', marginBottom: '15px' }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>}
            {wordsRef.current.map((word, idx) => (
              <span key={word.id} style={{ color: idx < revealedCount ? '#2d6a4f' : (isListening ? '#e9e4d4' : '#1a1a1a'), margin: '0 2px', display: 'inline' }}>
                {(!isListening || idx < revealedCount) ? word.original : '••••'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* خانة الأخطاء */}
      {errorsLog.length > 0 && (
        <div style={{ maxWidth: '850px', margin: '15px auto' }}>
          <strong style={{ color: '#bc4749' }}>⚠️ سجل التنبيهات (آخر الكلمات):</strong>
          {errorsLog.map((err, i) => (
            <div key={i} className="error-box">
               قلت: <span style={{ textDecoration: 'line-through' }}>{err.said}</span> | الصحيح: <strong>{err.correct}</strong>
            </div>
          ))}
        </div>
      )}

      {/* الشريط السفلي لما تقوله الآن */}
      {isListening && (
        <div className="live-bar">
          <span style={{ fontSize: '12px', opacity: 0.8 }}>أنت تقول الآن:</span> <br/>
          {liveTranscript || "استمر في القراءة..."}
        </div>
      )}
    </div>
  );
}
