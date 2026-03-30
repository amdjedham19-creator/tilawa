import React, { useState, useEffect, useRef, useCallback } from "react";

const NORMALIZE_MAP = {
  أ: "ا", إ: "ا", آ: "ا", ة: "ه", ى: "ي",
};

function normalizeArabic(text) {
  if (!text) return "";
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F]/g, "")
    .split("")
    .map((c) => NORMALIZE_MAP[c] || c)
    .join("")
    .trim();
}

const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

export default function QuranRecitationChecker() {
  const [surahNumber, setSurahNumber] = useState(1);
  const [ayahStart, setAyahStart] = useState(1);
  const [ayahEnd, setAyahEnd] = useState(7);
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [surahInfo, setSurahInfo] = useState(null);

  const recognitionRef = useRef(null);
  const currentIndexRef = useRef(0);
  const wordsRef = useRef([]);
  const listeningRef = useRef(false);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  const fetchAyahs = async () => {
    setLoading(true);
    setError("");
    setWords([]);
    setCurrentIndex(0);
    setErrors([]);
    setLiveTranscript("");
    try {
      const responses = await Promise.all(
        Array.from({ length: ayahEnd - ayahStart + 1 }, (_, i) =>
          fetch(
            `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahStart + i}/quran-uthmani`
          ).then((r) => r.json())
        )
      );
      const allWords = [];
      responses.forEach((res) => {
        if (res.code !== 200) throw new Error("فشل في جلب الآيات");
        const ayahText = res.data.text;
        setSurahInfo(res.data.surah);
        ayahText.split(" ").forEach((w) => {
          if (w.trim()) allWords.push({ original: w.trim(), revealed: false });
        });
      });
      setWords(allWords);
    } catch (e) {
      setError("حدث خطأ في جلب البيانات. تحقق من اتصالك بالإنترنت.");
    } finally {
      setLoading(false);
    }
  };

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("متصفحك لا يدعم التعرف الصوتي. استخدم Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setLiveTranscript(interim || final);

      if (final) {
        const spokenWords = final.trim().split(/\s+/);
        const currentWords = wordsRef.current;
        let idx = currentIndexRef.current;

        spokenWords.forEach((spoken) => {
          if (idx >= currentWords.length) return;
          const normalSpoken = normalizeArabic(spoken);
          const normalExpected = normalizeArabic(currentWords[idx].original);

          if (normalSpoken === normalExpected) {
            setWords((prev) => {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], revealed: true };
              return updated;
            });
            idx++;
            setCurrentIndex(idx);
          } else {
            setErrors((prev) => [
              ...prev,
              { spoken, expected: currentWords[idx].original },
            ]);
          }
        });
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        recognition.start();
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") {
        console.error("خطأ في التعرف الصوتي:", e.error);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    setLiveTranscript("");
  }, []);

  const handleReset = () => {
    stopListening();
    setWords([]);
    setCurrentIndex(0);
    setErrors([]);
    setLiveTranscript("");
    setError("");
    setSurahInfo(null);
  };

  const isFinished = words.length > 0 && currentIndex >= words.length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background-color: #e8e0d0;
          font-family: 'Amiri', serif;
          direction: rtl;
        }

        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px 120px;
          direction: rtl;
        }

        .header {
          text-align: center;
          margin-bottom: 28px;
        }

        .header h1 {
          font-size: 2.2rem;
          color: #2d6a4f;
          font-family: 'Amiri', serif;
          font-weight: 700;
        }

        .header p {
          color: #555;
          font-size: 1rem;
          margin-top: 6px;
        }

        .controls-card {
          background: #f4f1ea;
          border: 2px solid #2d6a4f;
          border-radius: 12px;
          padding: 20px 24px;
          width: 100%;
          max-width: 700px;
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
          justify-content: center;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .control-group label {
          font-size: 0.95rem;
          color: #2d6a4f;
          font-weight: bold;
        }

        .control-group select,
        .control-group input {
          padding: 8px 12px;
          border: 1.5px solid #2d6a4f;
          border-radius: 8px;
          font-family: 'Amiri', serif;
          font-size: 1rem;
          background: #fff;
          color: #333;
          direction: rtl;
          min-width: 80px;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          font-family: 'Amiri', serif;
          font-size: 1rem;
          cursor: pointer;
          font-weight: bold;
          transition: opacity 0.2s;
        }

        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-primary { background: #2d6a4f; color: white; }
        .btn-danger  { background: #c0392b; color: white; }
        .btn-secondary { background: #888; color: white; }

        .quran-card {
          background: #f4f1ea;
          border: 3px solid #2d6a4f;
          border-radius: 14px;
          padding: 28px 32px;
          width: 100%;
          max-width: 800px;
          margin-bottom: 20px;
          box-shadow: 0 4px 20px rgba(45, 106, 79, 0.15);
        }

        .surah-title {
          text-align: center;
          color: #2d6a4f;
          font-size: 1.3rem;
          margin-bottom: 18px;
          font-weight: bold;
          border-bottom: 1px solid #2d6a4f55;
          padding-bottom: 10px;
        }

        .quran-text {
          font-family: 'Amiri', serif;
          font-size: 36px;
          line-height: 2.2;
          text-align: justify;
          direction: rtl;
          color: #1a1a1a;
          word-spacing: 6px;
        }

        .word-revealed {
          color: #2d6a4f;
          font-weight: bold;
        }

        .word-current {
          color: #2d6a4f;
          background: #d4edda55;
          border-radius: 4px;
          padding: 0 2px;
        }

        .word-hidden {
          color: #aaa;
          letter-spacing: 2px;
          font-size: 22px;
        }

        .mic-controls {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .listening-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #c0392b;
          font-size: 1rem;
          font-weight: bold;
        }

        .pulse-dot {
          width: 12px;
          height: 12px;
          background: #c0392b;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }

        .errors-card {
          background: #fff5f5;
          border: 2px solid #c0392b;
          border-radius: 12px;
          padding: 16px 20px;
          width: 100%;
          max-width: 800px;
          margin-bottom: 20px;
        }

        .errors-card h3 {
          color: #c0392b;
          margin-bottom: 10px;
          font-size: 1.1rem;
        }

        .error-item {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid #f5c6cb;
          font-size: 1.1rem;
        }

        .error-spoken { color: #c0392b; }
        .error-arrow { color: #888; }
        .error-expected { color: #2d6a4f; font-weight: bold; }

        .success-banner {
          background: #d4edda;
          border: 2px solid #2d6a4f;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          color: #2d6a4f;
          font-size: 1.4rem;
          font-weight: bold;
          width: 100%;
          max-width: 800px;
          margin-bottom: 20px;
        }

        .live-bar {
          position: fixed;
          bottom: 0;
          right: 0;
          left: 0;
          background: #2d6a4f;
          color: white;
          padding: 12px 24px;
          direction: rtl;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          min-height: 56px;
        }

        .live-bar-label {
          font-size: 0.95rem;
          opacity: 0.8;
          white-space: nowrap;
          font-weight: bold;
        }

        .live-bar-text {
          font-family: 'Amiri', serif;
          font-size: 1.2rem;
          flex: 1;
        }

        .error-msg {
          color: #c0392b;
          background: #fff5f5;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          padding: 10px 16px;
          margin-top: 10px;
          font-size: 1rem;
          text-align: center;
        }
      `}</style>

      <div className="app-container">
        <div className="header">
          <h1>📖 مُصحح التلاوة</h1>
          <p>اختر السورة والآيات ثم ابدأ التلاوة</p>
        </div>

        {/* Controls */}
        <div className="controls-card">
          <div className="control-group">
            <label>رقم السورة</label>
            <select
              value={surahNumber}
              onChange={(e) => setSurahNumber(Number(e.target.value))}
              disabled={listening}
            >
              {SURAHS.map((n) => (
                <option key={n} value={n}>سورة {n}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>من آية</label>
            <input
              type="number"
              min={1}
              value={ayahStart}
              onChange={(e) => setAyahStart(Number(e.target.value))}
              disabled={listening}
            />
          </div>
          <div className="control-group">
            <label>إلى آية</label>
            <input
              type="number"
              min={ayahStart}
              value={ayahEnd}
              onChange={(e) => setAyahEnd(Number(e.target.value))}
              disabled={listening}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchAyahs}
            disabled={loading || listening}
          >
            {loading ? "جاري التحميل..." : "تحميل الآيات"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
          >
            إعادة تعيين
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Quran Text */}
        {words.length > 0 && (
          <div className="quran-card">
            {surahInfo && (
              <div className="surah-title">
                سورة {surahInfo.name} — الآيات {ayahStart} إلى {ayahEnd}
              </div>
            )}
            <div className="quran-text">
              {words.map((w, i) => {
                if (w.revealed) {
                  return (
                    <span key={i} className="word-revealed"> {w.original} </span>
                  );
                } else if (i === currentIndex) {
                  return (
                    <span key={i} className="word-current"> ••••• </span>
                  );
                } else {
                  return (
                    <span key={i} className="word-hidden"> ••••• </span>
                  );
                }
              })}
            </div>

            <div className="mic-controls">
              {!listening ? (
                <button
                  className="btn btn-primary"
                  onClick={startListening}
                  disabled={isFinished}
                >
                  🎙️ ابدأ التلاوة
                </button>
              ) : (
                <>
                  <div className="listening-indicator">
                    <div className="pulse-dot" />
                    جاري الاستماع...
                  </div>
                  <button className="btn btn-danger" onClick={stopListening}>
                    ⏹ إيقاف
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Success */}
        {isFinished && (
          <div className="success-banner">
            🎉 أحسنت! لقد أتممت التلاوة بنجاح
          </div>
        )}

        {/* Errors Log */}
        {errors.length > 0 && (
          <div className="errors-card">
            <h3>📋 سجل الأخطاء ({errors.length})</h3>
            {errors.map((e, i) => (
              <div key={i} className="error-item">
                <span className="error-spoken">❌ {e.spoken}</span>
                <span className="error-arrow">←</span>
                <span className="error-expected">✅ {e.expected}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Transcript Bar */}
      <div className="live-bar">
        <span className="live-bar-label">🎤 ما أقوله:</span>
        <span className="live-bar-text">
          {liveTranscript || (listening ? "في انتظار الكلام..." : "—")}
        </span>
      </div>
    </>
  );
}
