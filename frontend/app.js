// Akshara frontend — plain JS, no build step required.
const API_BASE = window.__API_BASE__ || (
  window.location.hostname === "127.0.0.1" || window.location.hostname === "0.0.0.0"
    ? "http://127.0.0.1:8000"
    : "http://localhost:8000"
);

const app = {
  state: {
    passage: null,
    numeracyTask: null,
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    isRecording: false,
    childAlias: "",
    language: "telugu",
    manualTranscript: "",
    handwritingDataUrl: null,
    sessions: [],
    demoMode: false,
    currentReport: null,
    currentSummary: "",
  },

  showStep(id) {
    document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
    const step = document.getElementById(id);
    if (step) step.classList.add("active");
  },

  showSetup() {
    this.clearDemoMarkers();
    this.showStep("step-setup");
  },

  showDashboard() {
    this.loadDashboard();
    this.showStep("step-dashboard");
  },

  clearDemoMarkers() {
    this.state.demoMode = false;
    this.state.audioBlob = null;
    this.state.handwritingDataUrl = null;
    this.state.manualTranscript = "";
    const status = document.getElementById("recordStatus");
    if (status) status.textContent = "";
    const btn = document.getElementById("recordBtn");
    if (btn) btn.textContent = "● Record";
  },

  async loadDashboard() {
    const container = document.getElementById("sessionHistoryList");
    if (!container) return;

    container.innerHTML = '<div class="session-empty">Loading recent sessions…</div>';

    try {
      const resp = await fetch(`${API_BASE}/api/sessions`);
      if (!resp.ok) throw new Error("Sessions endpoint unavailable");
      const sessions = await resp.json();
      if (!sessions.length) {
        container.innerHTML = '<div class="session-empty">No sessions yet. Start a screening to create the first report.</div>';
        return;
      }

      const resolved = await Promise.all(sessions.slice(0, 5).map(async (session) => {
        try {
          const detailResp = await fetch(`${API_BASE}/api/session/${session.id}`);
          if (!detailResp.ok) return null;
          return await detailResp.json();
        } catch {
          return null;
        }
      }));

      const valid = resolved.filter(Boolean);
      if (!valid.length) {
        container.innerHTML = '<div class="session-empty">No detailed session reports were available yet.</div>';
        return;
      }

      container.innerHTML = valid.map((report) => `
        <div class="session-card">
          <div class="session-card-top">
            <h3>${report.child_alias}</h3>
            <span class="risk-badge risk-${report.risk.level}">${report.risk.level.replace("_", " ")}</span>
          </div>
          <div class="session-meta">${report.language || 'telugu'} • ${new Date(report.session_id).toISOString ? 'Recent session' : 'Recent session'}</div>
          <div class="session-summary">${report.risk.summary}</div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = '<div class="session-empty">The backend is offline right now. Start a demo case or run the API locally.</div>';
    }
  },

  generateDemoAudioBlob() {
    const sampleRate = 22050;
    const duration = 2.8;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);
    const writeString = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, totalSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, Math.max(0, 1 - (i / totalSamples)));
      const tone = Math.sin(2 * Math.PI * 220 * t) * 0.35 + Math.sin(2 * Math.PI * 330 * t) * 0.2;
      const value = Math.max(-1, Math.min(1, tone * envelope));
      view.setInt16(offset, value * 32767, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  },

  drawDemoHandwriting() {
    const canvas = document.getElementById("hwCanvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(35, 140);
    ctx.lineTo(250, 110);
    ctx.lineTo(350, 150);
    ctx.lineTo(520, 90);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(60, 170);
    ctx.lineTo(260, 190);
    ctx.lineTo(420, 170);
    ctx.lineTo(560, 205);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(80, 65);
    ctx.lineTo(170, 65);
    ctx.moveTo(200, 65);
    ctx.lineTo(340, 65);
    ctx.moveTo(360, 65);
    ctx.lineTo(470, 65);
    ctx.stroke();
  },

  async loadDemoCase(language = null) {
    const selectedLanguage = language || document.getElementById("language")?.value || "telugu";
    this.state.language = selectedLanguage;

    try {
      const resp = await fetch(`${API_BASE}/api/demo-case?language=${selectedLanguage}`);
      if (!resp.ok) throw new Error("Demo case unavailable");
      const data = await resp.json();
      const demoPassage = data.passage;

      this.state.demoMode = true;
      this.state.childAlias = data.child_alias;
      this.state.manualTranscript = demoPassage.text;
      document.getElementById("childAlias").value = this.state.childAlias;
      document.getElementById("language").value = this.state.language;
      this.state.passage = demoPassage;
      this.state.numeracyTask = data.numeracy;

      document.getElementById("passageWords").textContent = demoPassage.text;
      document.getElementById("passageText").textContent = demoPassage.text;
      this.drawDemoHandwriting();
      this.state.handwritingDataUrl = document.getElementById("hwCanvas").toDataURL("image/png");
      this.state.audioBlob = this.generateDemoAudioBlob();
      this.renderNumeracy();
      this.showStep("step-handwriting");
      return;
    } catch (err) {
      const localDemoMap = {
        telugu: { text: "అమ్మ ఇంటికి వచ్చింది. నాన్న school కి వెళ్ళాడు. పాప పుస్తకం చదివింది.", translation_note: "Sample demo case using a Telugu passage with a bilingual sentence." },
        hindi: { text: "माँ घर आई। पिता स्कूल गए। बच्ची ने पुस्तक पढ़ी।", translation_note: "Sample Hindi passage with one mixed-language word." },
        tamil: { text: "அம்மா வீட்டுக்கு வந்தார். அப்பா பள்ளிக்கு சென்றார். சிறுமி புத்தகத்தைப் படித்தார்.", translation_note: "Sample Tamil passage with one mixed-language word." },
        kannada: { text: "ಅಮ್ಮ ಮನೆಗೆ ಬಂದಳು. ನಾನ್ನ school ಗೆ ಹೋದನು. ಹುಡುಗಿಯು ಪುಸ್ತಕವನ್ನು ಓದಿದಳು.", translation_note: "Sample Kannada passage with one mixed-language word." },
      };

      const demoPassage = localDemoMap[selectedLanguage] || localDemoMap.telugu;
      this.state.demoMode = true;
      this.state.childAlias = "Demo-Student";
      this.state.manualTranscript = demoPassage.text;
      document.getElementById("childAlias").value = this.state.childAlias;
      document.getElementById("language").value = selectedLanguage;
      this.state.passage = demoPassage;
      this.state.numeracyTask = {
        questions: [
          { prompt: "5 + 3 = ?", answer: 8 },
          { prompt: "9 - 4 = ?", answer: 5 },
          { prompt: "2 x 6 = ?", answer: 12 },
          { prompt: "Which is bigger: 7 or 12?", answer: "12" },
          { prompt: "10 - 7 = ?", answer: 3 }
        ]
      };

      document.getElementById("passageWords").textContent = demoPassage.text;
      document.getElementById("passageText").textContent = demoPassage.text;
      this.drawDemoHandwriting();
      this.state.handwritingDataUrl = document.getElementById("hwCanvas").toDataURL("image/png");
      this.state.audioBlob = this.generateDemoAudioBlob();
      this.renderNumeracy();
      this.showStep("step-handwriting");
    }
  },

  async startSession() {
    const alias = document.getElementById("childAlias").value.trim();
    if (!alias) { alert("Please enter a child alias or roll number."); return; }
    const language = document.getElementById("language").value;
    this.state.childAlias = alias;
    this.state.language = language;

    try {
      const resp = await fetch(`${API_BASE}/api/passage?language=${language}`);
      if (!resp.ok) throw new Error("Backend unavailable");
      const data = await resp.json();
      this.state.passage = data.passage;
      this.state.numeracyTask = data.numeracy;

      document.getElementById("passageWords").textContent = data.passage.text;
      document.getElementById("passageText").textContent = data.passage.text;

      this.setupCanvas();
      this.renderNumeracy();
      this.showStep("step-handwriting");
    } catch (err) {
      const fallback = confirm("The backend is offline. Would you like to load the built-in demo case instead?");
      if (fallback) this.loadDemoCase();
      else alert("Could not load passage from server. Run the backend locally or use demo mode.");
    }
  },

  // ---------- Handwriting canvas ----------
  setupCanvas() {
    const canvas = document.getElementById("hwCanvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    let drawing = false;

    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const point = e.touches ? e.touches[0] : e;
      return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
    };

    const start = (e) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const end = () => { drawing = false; };

    canvas.onmousedown = start; canvas.onmousemove = move; canvas.onmouseup = end; canvas.onmouseleave = end;
    canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
  },

  clearCanvas() {
    const canvas = document.getElementById("hwCanvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  },

  nextFromHandwriting() {
    const canvas = document.getElementById("hwCanvas");
    this.state.handwritingDataUrl = canvas.toDataURL("image/png");
    this.showStep("step-speech");
  },

  // ---------- Audio recording ----------
  async toggleRecording() {
    const btn = document.getElementById("recordBtn");
    const status = document.getElementById("recordStatus");
    if (!this.state.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.state.audioChunks = [];
        this.state.mediaRecorder = new MediaRecorder(stream);
        this.state.mediaRecorder.ondataavailable = (e) => this.state.audioChunks.push(e.data);
        this.state.mediaRecorder.onstop = () => {
          this.state.audioBlob = new Blob(this.state.audioChunks, { type: "audio/webm" });
          status.textContent = `Recorded (${(this.state.audioBlob.size / 1024).toFixed(0)} KB)`;
        };
        this.state.mediaRecorder.start();
        this.state.isRecording = true;
        btn.textContent = "■ Stop";
        status.textContent = "Recording...";
      } catch (err) {
        alert("Microphone access is needed for this step: " + err.message);
      }
    } else {
      this.state.mediaRecorder.stop();
      this.state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      this.state.isRecording = false;
      btn.textContent = "● Record";
    }
  },

  nextFromSpeech() {
    if (!this.state.audioBlob) { alert("Please record the read-aloud task first."); return; }
    this.state.manualTranscript = document.getElementById("manualTranscript").value.trim();
    this.showStep("step-numeracy");
  },

  // ---------- Numeracy ----------
  renderNumeracy() {
    const container = document.getElementById("numeracyQuestions");
    container.innerHTML = "";
    this.state.numeracyTask.questions.forEach((q, i) => {
      const div = document.createElement("div");
      div.className = "numeracy-q";
      div.innerHTML = `<label>${q.prompt}</label><input type="text" data-idx="${i}" class="numeracy-input">`;
      container.appendChild(div);
    });
  },

  gradeNumeracy() {
    const inputs = document.querySelectorAll(".numeracy-input");
    let correct = 0;
    inputs.forEach(inp => {
      const idx = parseInt(inp.dataset.idx, 10);
      const expected = String(this.state.numeracyTask.questions[idx].answer).trim().toLowerCase();
      const given = inp.value.trim().toLowerCase();
      if (given === expected) correct += 1;
    });
    return { correct, total: inputs.length };
  },

  // ---------- Submit ----------
  async submitSession() {
    const { correct, total } = this.gradeNumeracy();
    const form = new FormData();
    form.append("child_alias", this.state.childAlias);
    form.append("language", this.state.language);
    form.append("handwriting_image", this.state.handwritingDataUrl);
    form.append("numeracy_correct", correct);
    form.append("numeracy_total", total);
    form.append("manual_transcript", this.state.manualTranscript || "");
    form.append("audio", this.state.audioBlob, this.state.demoMode ? "demo.wav" : "clip.webm");

    const btn = document.querySelector('#step-numeracy .primary');
    btn.disabled = true; btn.textContent = "Analyzing...";

    try {
      const resp = await fetch(`${API_BASE}/api/session/submit`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const report = await resp.json();
      this.renderReport(report);
      this.showStep("step-report");
      await this.loadDashboard();
    } catch (err) {
      alert("Submission failed: " + err.message);
    } finally {
      btn.disabled = false; btn.textContent = "Finish & See Report";
    }
  },

  // ---------- Report rendering ----------
  getTeacherSummary(report) {
    const level = report.risk.level;
    const signals = [
      ...report.handwriting.signals.map(s => s.label),
      ...report.speech.signals.map(s => s.label),
      ...report.risk.contributing_signals,
    ];

    if (level === 'recommend_assessment') {
      return `This child shows multiple classroom indicators that warrant a full expert assessment. The strongest patterns include ${signals.slice(0, 2).join(', ')} and the risk score is elevated enough that teacher observation should continue alongside formal review.`;
    }
    if (level === 'watch') {
      return `This child shows some early signals worth monitoring. The patterns are mild enough to watch closely over the next few weeks, and re-screening is recommended rather than immediate formal referral.`;
    }
    return `This child appears to be within the normal range for this screening pass. Continue classroom observation and repeat screening later if the teacher notices persistent reading or writing difficulties.`;
  },

  saveCurrentReportToLocalStorage() {
    if (!this.state.currentReport) {
      alert('There is no report to save yet.');
      return;
    }
    const saved = JSON.parse(localStorage.getItem('akshara_local_reports') || '[]');
    const next = [this.state.currentReport, ...saved.filter(item => item.session_id !== this.state.currentReport.session_id)];
    localStorage.setItem('akshara_local_reports', JSON.stringify(next.slice(0, 10)));
    alert('Report saved locally for offline review.');
    this.loadDashboard();
  },

  renderReport(report) {
    this.state.currentReport = report;
    const el = document.getElementById("reportContent");
    const riskLabels = { low: "Low concern", watch: "Worth watching", recommend_assessment: "Recommend assessment" };

    const signalRows = (signals) => signals.map(s => `
      <div class="signal-row">
        <span>${s.label.replaceAll("_", " ")}</span>
        <div class="signal-bar-bg"><div class="signal-bar-fill" style="width:${Math.round(s.severity * 100)}%"></div></div>
      </div>`).join("");

    const summary = report.risk.summary || "No summary available.";
    const actionSummary = this.getTeacherSummary(report);
    const nextStep = report.risk.recommended_next_step || "Keep observing.";

    el.innerHTML = `
      <p><strong>${report.child_alias}</strong></p>
      <span class="risk-badge risk-${report.risk.level}">${riskLabels[report.risk.level]}</span>
      <p style="margin-top:14px"><strong>Teacher summary:</strong> ${actionSummary}</p>
      <p><strong>System summary:</strong> ${summary}</p>
      <p><strong>Suggested next step:</strong> ${nextStep}</p>

      <div class="section-title">Handwriting signals</div>
      ${signalRows(report.handwriting.signals)}

      <div class="section-title">Read-aloud fluency signals</div>
      ${signalRows(report.speech.signals)}
      <p class="report-notes">Estimated pace: ${report.speech.estimated_words_per_minute ?? "n/a"} wpm (rough proxy, not a validated measure).</p>

      <div class="section-title">Code-switching</div>
      <p>${report.code_switch.notes}</p>

      <div class="section-title">Numeracy</div>
      <p>${report.numeracy.correct} / ${report.numeracy.total} correct</p>

      <p class="report-notes">This is a screening flag generated by an MVP prototype using simplified heuristics
      in place of the fully trained models described in the project proposal. It is not a diagnosis and should
      not be treated as one.</p>
    `;
  },

  reset() {
    this.state.audioBlob = null;
    this.state.handwritingDataUrl = null;
    this.state.manualTranscript = "";
    this.state.demoMode = false;
    this.state.currentReport = null;
    document.getElementById("childAlias").value = "";
    document.getElementById("recordStatus").textContent = "";
    this.showStep("step-setup");
  },
};

window.addEventListener("DOMContentLoaded", () => {
  app.clearDemoMarkers();
  app.loadDashboard();
});
