import React, { useState, useEffect, useRef, useCallback } from "react";

const SURAH_NAMES = [
  "الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال",
  "التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء",
  "الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء",
  "النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر",
  "يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان",
  "الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم",
  "القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف",
  "الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة",
  "المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات",
  "النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج",
  "الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح",
  "التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر",
  "العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر",
  "المسد","الإخلاص","الفلق","الناس",
];

// ============================================================
// التطبيع الشامل - يوحّد كل الحروف المتشابهة صوتياً
// ============================================================
function normalize(text) {
  if (!text) return "";
  return text
    // إزالة التشكيل الكامل
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, "")
    // إزالة رموز التلاوة والوقف
    .replace(/[\u06D6-\u06ED]/g, "")
    // إزالة الشدة والمد وما شابه
    .replace(/[\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658]/g, "")
    // توحيد كل أشكال الألف
    .replace(/[أإآٱا]/g, "ا")
    // التاء المربوطة = هاء
    .replace(/ة/g, "ه")
    // الألف المقصورة = ياء
    .replace(/ى/g, "ي")
    // إزالة الواو الزائدة في بعض الكلمات مثل "عمرو"
    // توحيد الهمزات
    .replace(/[ئء]/g, "")
    // إزالة المسافات الزائدة
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// المطابقة الذكية: تبحث عن أفضل تطابق في نافذة من الكلمات
// بدلاً من المقارنة الصارمة كلمة بكلمة
// ============================================================
function findBestMatch(spokenWords, quranWords, startIdx) {
  const results = [];

  // نأخذ نافذة بحث = عدد الكلمات المنطوقة + هامش خطأ
  const windowSize = spokenWords.length + 3;

  for (let qi = startIdx; qi < Math.min(startIdx + windowSize, quranWords.length); qi++) {
    const qNorm = normalize(quranWords[qi].original);

    for (let si = 0; si < spokenWords.length; si++) {
      const sNorm = normalize(spokenWords[si]);
      if (sNorm && qNorm && sNorm === qNorm) {
        results.push({ quranIdx: qi, spokenIdx: si });
      }
    }
  }

  return results;
}

// حساب التشابه بين كلمتين (للكلمات المتقاربة)
function similarity(a, b) {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  // إذا كانت إحداهما تحتوي على الأخرى
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  // نسبة الحروف المشتركة
  const setA = new Set(na.split(""));
  const setB = new Set(nb.split(""));
  const intersection = [...setA].filter((c) => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export default function QuranRecitationChecker() {
  const [surahNumber, setSurahNumber] = useState(1);
  const [ayahStart, setAyahStart]     = useState(1);
  const [ayahEnd, setAyahEnd]         = useState(7);
  const [words, setWords]             = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase]             = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [currentError, setCurrentError]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetchError, setFetchError]   = useState("");
  const [surahInfo, setSurahInfo]     = useState(null);

  const recognitionRef  = useRef(null);
  const currentIndexRef = useRef(0);
  const wordsRef        = useRef([]);
  const listeningRef    = useRef(false);
  // نحفظ آخر نص نهائي معالَج لتجنب المعالجة المزدوجة
  const lastFinalRef    = useRef("");

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { wordsRef.current = words; }, [words]);

  // -------------------------------------------------------
  // جلب الآيات
  // -------------------------------------------------------
  const fetchAyahs = async () => {
    setLoading(true);
    setFetchError("");
    setWords([]);
    setCurrentIndex(0);
    setCurrentError(null);
    setLiveTranscript("");
    setPhase("idle");
    lastFinalRef.current = "";
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
        if (res.code !== 200) throw new Error("فشل");
        setSurahInfo(res.data.surah);
        res.data.text.split(" ").forEach((w) => {
          const clean = w.trim();
          if (clean) allWords.push({ original: clean, revealed: false });
        });
      });
      setWords(allWords);
      setPhase("preview");
    } catch {
      setFetchError("حدث خطأ في جلب البيانات. تحقق من اتصالك.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // معالجة النص المنطوق - القلب الأساسي للتطبيق
  // -------------------------------------------------------
  const processSpokenText = useCallback((finalText) => {
    // تجنب معالجة نفس النص مرتين
    if (!finalText || finalText === lastFinalRef.current) return;
    lastFinalRef.current = finalText;

    const ws = wordsRef.current;
    let idx = currentIndexRef.current;
    if (idx >= ws.length) return;

    // تقسيم النص المنطوق إلى كلمات
    const spokenWords = finalText.trim().split(/\s+/).filter(Boolean);
    if (!spokenWords.length) return;

    let si = 0; // مؤشر الكلمة المنطوقة الحالية

    while (si < spokenWords.length && idx < ws.length) {
      const spokenNorm   = normalize(spokenWords[si]);
      const expectedNorm = normalize(ws[idx].original);

      if (!spokenNorm) { si++; continue; }

      // ---- حالة 1: تطابق مباشر ✅ ----
      if (spokenNorm === expectedNorm) {
        setWords((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], revealed: true };
          return updated;
        });
        setCurrentError(null);
        idx++;
        si++;
        setCurrentIndex(idx);
        continue;
      }

      // ---- حالة 2: الكلمة المنطوقة تحتوي على الكلمة المطلوبة (دمج كلمتين) ----
      // مثلاً: قال "بسم" وكان مطلوباً "بسم"
      if (spokenNorm.startsWith(expectedNorm) || spokenNorm.endsWith(expectedNorm)) {
        setWords((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], revealed: true };
          return updated;
        });
        setCurrentError(null);
        idx++;
        setCurrentIndex(idx);
        // لا نتقدم في si لأن الكلمة المنطوقة قد تحتوي على أكثر من كلمة
        si++;
        continue;
      }

      // ---- حالة 3: البحث للأمام - هل الكلمة المنطوقة تطابق كلمة قادمة؟ ----
      // هذا يحل مشكلة تجاوز كلمة صحيحة
      let foundAhead = -1;
      const lookAhead = Math.min(3, ws.length - idx - 1); // ننظر 3 كلمات للأمام فقط
      for (let ahead = 1; ahead <= lookAhead; ahead++) {
        if (normalize(ws[idx + ahead]?.original) === spokenNorm) {
          foundAhead = ahead;
          break;
        }
      }

      if (foundAhead > 0) {
        // الكلمة المنطوقة صحيحة لكنها تطابق كلمة قادمة
        // نعتبر الكلمات المتجاوزة صحيحة أيضاً (ربما نطقها بسرعة)
        for (let k = 0; k <= foundAhead; k++) {
          const revIdx = idx + k;
          setWords((prev) => {
            const updated = [...prev];
            updated[revIdx] = { ...updated[revIdx], revealed: true };
            return updated;
          });
        }
        setCurrentError(null);
        idx += foundAhead + 1;
        si++;
        setCurrentIndex(idx);
        continue;
      }

      // ---- حالة 4: تشابه عالٍ (أكثر من 80%) - نعتبرها صحيحة ----
      const sim = similarity(spokenWords[si], ws[idx].original);
      if (sim >= 0.8) {
        setWords((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], revealed: true };
          return updated;
        });
        setCurrentError(null);
        idx++;
        si++;
        setCurrentIndex(idx);
        continue;
      }

      // ---- حالة 5: خطأ حقيقي ----
      setCurrentError({ spoken: spokenWords[si], expected: ws[idx].original });
      si++; // ننتقل للكلمة المنطوقة التالية لكن نبقى في نفس موضع القرآن
    }

    if (idx >= ws.length) {
      listeningRef.current = false;
      setPhase("done");
      recognitionRef.current?.stop();
    }
  }, []);

  // -------------------------------------------------------
  // الميكروفون
  // -------------------------------------------------------
  const startMic = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFetchError("متصفحك لا يدعم التعرف الصوتي. استخدم Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3; // نطلب بدائل متعددة لاختيار الأفضل

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText   = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        // نأخذ أفضل بديل
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += " " + transcript;
        } else {
          interimText += transcript;
        }
      }

      // عرض ما يقوله المستخدم لحظياً
      setLiveTranscript(interimText || finalText.trim());

      // معالجة النص النهائي فقط
      if (finalText.trim()) {
        processSpokenText(finalText.trim());
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        // إعادة التشغيل التلقائي
        setTimeout(() => {
          if (listeningRef.current) {
            try { recognition.start(); } catch {}
          }
        }, 100);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech") return; // طبيعي
      if (e.error === "aborted") return;
      console.warn("خطأ صوتي:", e.error);
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    lastFinalRef.current = "";
    recognition.start();
  }, [processSpokenText]);

  const startReciting = useCallback(() => {
    setPhase("reciting");
    setCurrentError(null);
    setLiveTranscript("");
    lastFinalRef.current = "";
    startMic();
  }, [startMic]);

  const stopMic = useCallback(() => {
    listeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
  }, []);

  const handleStop = () => {
    stopMic();
    setPhase("preview");
    setCurrentIndex(0);
    setCurrentError(null);
    setLiveTranscript("");
    lastFinalRef.current = "";
    setWords((prev) => prev.map((w) => ({ ...w, revealed: false })));
  };

  const handleReset = () => {
    stopMic();
    setWords([]);
    setCurrentIndex(0);
    setCurrentError(null);
    setLiveTranscript("");
    setFetchError("");
    setSurahInfo(null);
    setPhase("idle");
    lastFinalRef.current = "";
  };

  const isFinished = phase === "done";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #e8e0d0; font-family: 'Amiri', serif; direction: rtl; }

        .app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 24px 16px 40px; direction: rtl; }

        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 2.2rem; color: #2d6a4f; font-weight: 700; }
        .header p  { color: #555; font-size: 1rem; margin-top: 6px; }

        .live-bar {
          width: 100%; max-width: 820px;
          background: #2d6a4f; color: #fff;
          border-radius: 12px; padding: 12px 20px;
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 12px; min-height: 52px;
        }
        .live-bar-label { font-size: .95rem; opacity: .8; white-space: nowrap; font-weight: bold; }
        .live-bar-text  { font-family: 'Amiri', serif; font-size: 1.25rem; flex: 1; }

        .correction-bar {
          width: 100%; max-width: 820px;
          border-radius: 12px; padding: 10px 20px;
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 16px; min-height: 48px;
          transition: background .3s, border .3s;
        }
        .correction-bar.has-error { background: #fff0f0; border: 2px solid #c0392b; }
        .correction-bar.no-error  { background: #f0fff4; border: 2px solid #2d6a4f; }
        .correction-label     { font-size: .95rem; font-weight: bold; white-space: nowrap; }
        .correction-label.err { color: #c0392b; }
        .correction-label.ok  { color: #2d6a4f; }
        .correction-content   { font-family: 'Amiri', serif; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; }
        .spoken-wrong  { color: #c0392b; }
        .arrow         { color: #888; }
        .expected-word { color: #2d6a4f; font-weight: bold; }

        .controls-card {
          background: #f4f1ea; border: 2px solid #2d6a4f;
          border-radius: 12px; padding: 18px 22px;
          width: 100%; max-width: 820px;
          display: flex; flex-wrap: wrap; gap: 14px;
          align-items: flex-end; justify-content: center;
          margin-bottom: 18px;
        }
        .control-group { display: flex; flex-direction: column; gap: 5px; }
        .control-group label { font-size: .95rem; color: #2d6a4f; font-weight: bold; }

        .surah-select-wrapper { position: relative; }
        .surah-select {
          appearance: none; -webkit-appearance: none;
          padding: 9px 38px 9px 14px;
          border: 1.5px solid #2d6a4f; border-radius: 10px;
          font-family: 'Amiri', serif; font-size: 1.05rem;
          background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%232d6a4f' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat left 12px center;
          color: #1a1a1a; direction: rtl; min-width: 170px;
          cursor: pointer; box-shadow: 0 1px 4px rgba(45,106,79,.1);
        }
        .surah-select:focus { outline: none; border-color: #1a4a35; box-shadow: 0 0 0 3px rgba(45,106,79,.2); }

        .ayah-input {
          padding: 9px 12px; border: 1.5px solid #2d6a4f; border-radius: 10px;
          font-family: 'Amiri', serif; font-size: 1rem;
          background: #fff; color: #333; direction: rtl; width: 80px;
        }

        .btn { padding: 10px 22px; border-radius: 10px; border: none; font-family: 'Amiri', serif; font-size: 1rem; cursor: pointer; font-weight: bold; transition: opacity .2s, transform .1s; }
        .btn:active { transform: scale(.97); }
        .btn:disabled { opacity: .45; cursor: not-allowed; }
        .btn-primary   { background: #2d6a4f; color: #fff; }
        .btn-danger    { background: #c0392b; color: #fff; }
        .btn-secondary { background: #7a7a7a; color: #fff; }
        .btn-start     { background: #1b5e3b; color: #fff; font-size: 1.1rem; padding: 12px 28px; }

        .quran-card {
          background: #f4f1ea; border: 3px solid #2d6a4f;
          border-radius: 14px; padding: 28px 32px;
          width: 100%; max-width: 820px;
          box-shadow: 0 4px 20px rgba(45,106,79,.15);
          margin-bottom: 20px;
        }
        .surah-title {
          text-align: center; color: #2d6a4f;
          font-size: 1.3rem; margin-bottom: 16px; font-weight: bold;
          border-bottom: 1px solid #2d6a4f55; padding-bottom: 10px;
        }
        .quran-text {
          font-family: 'Amiri', serif; font-size: 36px;
          line-height: 2.3; text-align: justify;
          direction: rtl; color: #1a1a1a; word-spacing: 5px;
        }
        .word-preview  { color: #1a1a1a; }
        .word-revealed { color: #2d6a4f; font-weight: bold; }
        .word-current  { color: #1b5e3b; background: #d4edda66; border-radius: 4px; padding: 0 3px; }
        .word-hidden   { color: #bbb; font-size: 22px; letter-spacing: 2px; }

        .mic-controls { display: flex; gap: 12px; justify-content: center; margin-top: 18px; flex-wrap: wrap; align-items: center; }
        .listening-label { color: #c0392b; font-weight: bold; display: flex; align-items: center; gap: 8px; }
        .listening-dot { width: 12px; height: 12px; background: #c0392b; border-radius: 50%; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:.6} }

        .success-banner {
          background: #d4edda; border: 2px solid #2d6a4f;
          border-radius: 12px; padding: 20px; text-align: center;
          color: #2d6a4f; font-size: 1.5rem; font-weight: bold;
          width: 100%; max-width: 820px; margin-bottom: 20px;
        }
        .error-msg {
          color: #c0392b; background: #fff5f5; border: 1px solid #f5c6cb;
          border-radius: 8px; padding: 10px 16px; margin-bottom: 12px;
          font-size: 1rem; text-align: center; width: 100%; max-width: 820px;
        }
      `}</style>

      <div className="app">
        <div className="header">
          <h1>📖 مُصحح التلاوة</h1>
          <p>اختر السورة والآيات ثم تلُ وسيصحح لك</p>
        </div>

        {/* شريط ما أقوله */}
        <div className="live-bar">
          <span className="live-bar-label">🎤 ما أقوله:</span>
          <span className="live-bar-text">
            {liveTranscript
              ? liveTranscript
              : phase === "reciting" ? "في انتظار الكلام..." : "—"}
          </span>
        </div>

        {/* خانة تصحيح الكلمة الحالية */}
        <div className={`correction-bar ${currentError ? "has-error" : "no-error"}`}>
          {currentError ? (
            <>
              <span className="correction-label err">⚠️ تصحيح:</span>
              <div className="correction-content">
                <span className="spoken-wrong">❌ {currentError.spoken}</span>
                <span className="arrow"> ← </span>
                <span className="expected-word">✅ {currentError.expected}</span>
              </div>
            </>
          ) : (
            <>
              <span className="correction-label ok">✅ الكلمة الحالية:</span>
              <div className="correction-content" style={{ color: "#2d6a4f" }}>
                {words[currentIndex]?.original ?? "—"}
              </div>
            </>
          )}
        </div>

        {/* لوحة التحكم */}
        <div className="controls-card">
          <div className="control-group">
            <label>السورة</label>
            <div className="surah-select-wrapper">
              <select
                className="surah-select"
                value={surahNumber}
                onChange={(e) => setSurahNumber(Number(e.target.value))}
                disabled={phase === "reciting"}
              >
                {SURAH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}. {name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="control-group">
            <label>من آية</label>
            <input className="ayah-input" type="number" min={1}
              value={ayahStart}
              onChange={(e) => setAyahStart(Number(e.target.value))}
              disabled={phase === "reciting"} />
          </div>
          <div className="control-group">
            <label>إلى آية</label>
            <input className="ayah-input" type="number" min={ayahStart}
              value={ayahEnd}
              onChange={(e) => setAyahEnd(Number(e.target.value))}
              disabled={phase === "reciting"} />
          </div>
          <button className="btn btn-primary" onClick={fetchAyahs}
            disabled={loading || phase === "reciting"}>
            {loading ? "جاري التحميل..." : "تحميل الآيات"}
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            إعادة تعيين
          </button>
        </div>

        {fetchError && <div className="error-msg">{fetchError}</div>}

        {/* بطاقة القرآن */}
        {words.length > 0 && (
          <div className="quran-card">
            {surahInfo && (
              <div className="surah-title">
                سورة {surahInfo.name} — الآيات {ayahStart} إلى {ayahEnd}
              </div>
            )}
            <div className="quran-text">
              {words.map((w, i) => {
                if (phase === "preview") {
                  return <span key={i} className="word-preview"> {w.original} </span>;
                }
                if (w.revealed) {
                  return <span key={i} className="word-revealed"> {w.original} </span>;
                }
                if (i === currentIndex) {
                  return <span key={i} className="word-current"> ••••• </span>;
                }
                return <span key={i} className="word-hidden"> ••••• </span>;
              })}
            </div>

            <div className="mic-controls">
              {phase === "preview" && (
                <button className="btn btn-start" onClick={startReciting}>
                  🎙️ ابدأ التلاوة
                </button>
              )}
              {phase === "reciting" && (
                <>
                  <div className="listening-label">
                    <div className="listening-dot" />
                    جاري الاستماع...
                  </div>
                  <button className="btn btn-danger" onClick={handleStop}>
                    ⏹ إيقاف
                  </button>
                </>
              )}
              {phase === "done" && (
                <button className="btn btn-primary" onClick={handleReset}>
                  🔄 تلاوة جديدة
                </button>
              )}
            </div>
          </div>
        )}

        {isFinished && (
          <div className="success-banner">🎉 أحسنت! أتممت التلاوة بنجاح</div>
        )}
      </div>
    </>
  );
                               }
