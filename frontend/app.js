// Akshara frontend controller.
const API_BASE = window.__API_BASE__ || (
  window.location.hostname === "127.0.0.1" || window.location.hostname === "0.0.0.0"
    ? "http://127.0.0.1:8000"
    : "https://akshara-backend-4czy.onrender.com"
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
    demoMode: false,
    currentReport: null,
  },

  showStep(id) {
    document.querySelectorAll(".step").forEach((step) => step.classList.remove("active"));
    const step = document.getElementById(id);
    if (step) step.classList.add("active");
  },

  showSetup() {
    this.clearDemoState();
    this.showStep("step-setup");
  },

  clearDemoState() {
    this.state.demoMode = false;
    this.state.audioBlob = null;
    this.state.handwritingDataUrl = null;
    this.state.manualTranscript = "";
    const status = document.getElementById("recordStatus");
    if (status) status.textContent = "";
    const button = document.getElementById("recordBtn");
    if (button) button.textContent = "● Record";
  },

  escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
  },

  async showDashboard() {
    this.showStep("step-dashboard");
    const container = document.getElementById("sessionHistoryList");
    container.innerHTML = '<div class="session-empty">Loading recent sessions...</div>';
    try {
      const response = await fetch(`${API_BASE}/api/sessions`);
      if (!response.ok) throw new Error("Sessions endpoint unavailable");
      const sessions = await response.json();
      if (!sessions.length) {
        container.innerHTML = '<div class="session-empty">No sessions yet. Start a screening to create the first report.</div>';
        return;
      }
      const reports = await Promise.all(sessions.slice(0, 10).map(async (session) => {
        const detail = await fetch(`${API_BASE}/api/session/${session.id}`);
        return detail.ok ? detail.json() : null;
      }));
      const validReports = reports.filter(Boolean);
      container.innerHTML = validReports.length ? validReports.map((report) => `
        <article class="session-card">
          <div class="session-card-top">
            <h3>${this.escapeHtml(report.child_alias)}</h3>
            <span class="risk-badge risk-${report.risk.level}">${report.risk.level.replaceAll("_", " ")}</span>
          </div>
          <div class="session-meta">${this.escapeHtml(report.language || "telugu")}</div>
          <div class="session-summary">${this.escapeHtml(report.risk.summary)}</div>
        </article>`).join("") : '<div class="session-empty">No detailed session reports are available.</div>';
    } catch (error) {
      container.innerHTML = '<div class="session-empty">The backend is offline. Start the API locally or use the demo case.</div>';
    }
  },

  generateDemoAudioBlob() {
    const sampleRate = 22050;
    const duration = 3.2;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); write(8, "WAVE");
    write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, samples * 2, true);
    for (let index = 0; index < samples; index += 1) {
      const time = index / sampleRate;
      const envelope = Math.max(0, 1 - index / samples);
      const signal = (Math.sin(2 * Math.PI * 220 * time) * 0.35 + Math.sin(2 * Math.PI * 330 * time) * 0.2) * envelope;
      view.setInt16(44 + index * 2, signal * 32767, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  },

  drawDemoHandwriting() {
    const canvas = document.getElementById("hwCanvas");
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "black";
    context.lineWidth = 4;
    context.lineCap = "round";
    [[35, 140, 250, 110, 350, 150, 520, 90], [60, 170, 260, 190, 420, 170, 560, 205], [80, 65, 170, 65, 200, 65, 340, 65]].forEach((points) => {
      context.beginPath();
      context.moveTo(points[0], points[1]);
      for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
      context.stroke();
    });
  },

  async loadDemoCase(language = null) {
    const selectedLanguage = language || document.getElementById("language").value || "telugu";
    try {
      const response = await fetch(`${API_BASE}/api/demo-case?language=${selectedLanguage}`);
      if (!response.ok) throw new Error("Demo unavailable");
      const data = await response.json();
      this.prepareDemo(data.child_alias, data.passage, data.numeracy, selectedLanguage);
    } catch (error) {
      const passages = {
        telugu: "అమ్మ ఇంటికి వచ్చింది. నాన్న school కి వెళ్ళాడు. పాప పుస్తకం చదివింది.",
        hindi: "माँ घर आई। पिता स्कूल गए। बच्ची ने पुस्तक पढ़ी।",
        tamil: "அம்மா வீட்டுக்கு வந்தார். அப்பா பள்ளிக்கு சென்றார். சிறுமி புத்தகத்தைப் படித்தார்.",
        kannada: "ಅಮ್ಮ ಮನೆಗೆ ಬಂದಳು. ನಾನ್ನ school ಗೆ ಹೋದನು. ಹುಡುಗಿಯು ಪುಸ್ತಕವನ್ನು ಓದಿದಳು."
      };
      const questions = [{ prompt: "5 + 3 = ?", answer: 8 }, { prompt: "9 - 4 = ?", answer: 5 }, { prompt: "2 x 6 = ?", answer: 12 }, { prompt: "Which is bigger: 7 or 12?", answer: "12" }, { prompt: "10 - 7 = ?", answer: 3 }];
      this.prepareDemo("Demo-Student", { text: passages[selectedLanguage] || passages.telugu }, { questions }, selectedLanguage);
    }
  },

  prepareDemo(alias, passage, numeracy, language) {
    this.state.demoMode = true;
    this.state.childAlias = alias;
    this.state.language = language;
    this.state.passage = passage;
    this.state.numeracyTask = numeracy;
    this.state.manualTranscript = passage.text;
    document.getElementById("childAlias").value = alias;
    document.getElementById("language").value = language;
    document.getElementById("passageWords").textContent = passage.text;
    document.getElementById("passageText").textContent = passage.text;
    this.drawDemoHandwriting();
    this.state.handwritingDataUrl = document.getElementById("hwCanvas").toDataURL("image/png");
    this.state.audioBlob = this.generateDemoAudioBlob();
    this.renderNumeracy();
    this.showStep("step-handwriting");
  },

  async startSession() {
    const alias = document.getElementById("childAlias").value.trim();
    if (!alias) return alert("Please enter a child alias or roll number.");
    this.state.childAlias = alias;
    this.state.language = document.getElementById("language").value;
    try {
      const response = await fetch(`${API_BASE}/api/passage?language=${this.state.language}`);
      if (!response.ok) throw new Error("Backend unavailable");
      const data = await response.json();
      this.state.passage = data.passage;
      this.state.numeracyTask = data.numeracy;
      document.getElementById("passageWords").textContent = data.passage.text;
      document.getElementById("passageText").textContent = data.passage.text;
      this.setupCanvas();
      this.renderNumeracy();
      this.showStep("step-handwriting");
    } catch (error) {
      if (confirm("The backend is offline. Load the built-in demo case instead?")) this.loadDemoCase(this.state.language);
      else alert("Could not load the passage. Start the backend or use demo mode.");
    }
  },

  setupCanvas() {
    const canvas = document.getElementById("hwCanvas");
    const context = canvas.getContext("2d");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "black"; context.lineWidth = 4; context.lineCap = "round";
    let drawing = false;
    const position = (event) => {
      const rect = canvas.getBoundingClientRect();
      const point = event.touches ? event.touches[0] : event;
      return { x: (point.clientX - rect.left) * canvas.width / rect.width, y: (point.clientY - rect.top) * canvas.height / rect.height };
    };
    const start = (event) => { drawing = true; const point = position(event); context.beginPath(); context.moveTo(point.x, point.y); event.preventDefault(); };
    const move = (event) => { if (!drawing) return; const point = position(event); context.lineTo(point.x, point.y); context.stroke(); event.preventDefault(); };
    const stop = () => { drawing = false; };
    canvas.onmousedown = start; canvas.onmousemove = move; canvas.onmouseup = stop; canvas.onmouseleave = stop;
    canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = stop;
  },

  clearCanvas() {
    const canvas = document.getElementById("hwCanvas");
    const context = canvas.getContext("2d"); context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
  },

  nextFromHandwriting() {
    this.state.handwritingDataUrl = document.getElementById("hwCanvas").toDataURL("image/png");
    this.showStep("step-speech");
  },

  async toggleRecording() {
    const button = document.getElementById("recordBtn");
    const status = document.getElementById("recordStatus");
    if (!this.state.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.state.audioChunks = [];
        this.state.mediaRecorder = new MediaRecorder(stream);
        this.state.mediaRecorder.ondataavailable = (event) => this.state.audioChunks.push(event.data);
        this.state.mediaRecorder.onstop = () => { this.state.audioBlob = new Blob(this.state.audioChunks, { type: "audio/webm" }); status.textContent = `Recorded (${Math.round(this.state.audioBlob.size / 1024)} KB)`; };
        this.state.mediaRecorder.start(); this.state.isRecording = true; button.textContent = "■ Stop"; status.textContent = "Recording...";
      } catch (error) { alert(`Microphone access is needed: ${error.message}`); }
    } else {
      this.state.mediaRecorder.stop(); this.state.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      this.state.isRecording = false; button.textContent = "● Record";
    }
  },

  nextFromSpeech() {
    if (!this.state.audioBlob) return alert("Please record the read-aloud task first.");
    this.state.manualTranscript = document.getElementById("manualTranscript").value.trim();
    this.showStep("step-numeracy");
  },

  renderNumeracy() {
    const container = document.getElementById("numeracyQuestions"); container.innerHTML = "";
    this.state.numeracyTask.questions.forEach((question, index) => {
      const item = document.createElement("div"); item.className = "numeracy-q";
      item.innerHTML = `<label>${this.escapeHtml(question.prompt)}</label><input type="text" data-idx="${index}" class="numeracy-input">`;
      container.appendChild(item);
    });
  },

  gradeNumeracy() {
    const inputs = document.querySelectorAll(".numeracy-input"); let correct = 0;
    inputs.forEach((input) => { const expected = String(this.state.numeracyTask.questions[Number(input.dataset.idx)].answer).trim().toLowerCase(); if (input.value.trim().toLowerCase() === expected) correct += 1; });
    return { correct, total: inputs.length };
  },

  async submitSession() {
    const result = this.gradeNumeracy(); const form = new FormData();
    form.append("child_alias", this.state.childAlias); form.append("language", this.state.language); form.append("handwriting_image", this.state.handwritingDataUrl);
    form.append("numeracy_correct", result.correct); form.append("numeracy_total", result.total); form.append("manual_transcript", this.state.manualTranscript || "");
    form.append("audio", this.state.audioBlob, this.state.demoMode ? "demo.wav" : "clip.webm");
    const button = document.querySelector("#step-numeracy .primary"); button.disabled = true; button.textContent = "Analyzing...";
    try {
      const response = await fetch(`${API_BASE}/api/session/submit`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      this.renderReport(await response.json()); this.showStep("step-report");
    } catch (error) { alert(`Submission failed: ${error.message}`); }
    finally { button.disabled = false; button.textContent = "Finish & See Report"; }
  },

  renderReport(report) {
    this.state.currentReport = report;
    const labels = { low: "Low concern", watch: "Worth watching", recommend_assessment: "Recommend assessment" };
    const rows = (signals) => signals.map((signal) => `<div class="signal-row"><span>${this.escapeHtml(signal.label.replaceAll("_", " "))}</span><div class="signal-bar-bg"><div class="signal-bar-fill" style="width:${Math.round(signal.severity * 100)}%"></div></div></div>`).join("");
    document.getElementById("reportContent").innerHTML = `
      <p><strong>${this.escapeHtml(report.child_alias)}</strong></p><span class="risk-badge risk-${report.risk.level}">${labels[report.risk.level]}</span>
      <p><strong>Summary:</strong> ${this.escapeHtml(report.risk.summary)}</p><p><strong>Suggested next step:</strong> ${this.escapeHtml(report.risk.recommended_next_step)}</p>
      <div class="section-title">Handwriting signals</div>${rows(report.handwriting.signals)}
      <div class="section-title">Read-aloud fluency signals</div>${rows(report.speech.signals)}
      <p class="report-notes">Estimated pace: ${report.speech.estimated_words_per_minute ?? "n/a"} wpm (rough proxy).</p>
      <div class="section-title">Code-switching</div><p>${this.escapeHtml(report.code_switch.notes)}</p>
      <div class="section-title">Numeracy</div><p>${report.numeracy.correct} / ${report.numeracy.total} correct</p>
      <p class="report-notes">This is an MVP screening flag, not a diagnosis.</p>`;
  },

  saveCurrentReportToLocalStorage() {
    if (!this.state.currentReport) return alert("There is no report to save yet.");
    const saved = JSON.parse(localStorage.getItem("akshara_local_reports") || "[]");
    const reports = [this.state.currentReport, ...saved.filter((item) => item.session_id !== this.state.currentReport.session_id)].slice(0, 10);
    localStorage.setItem("akshara_local_reports", JSON.stringify(reports)); alert("Report saved locally for offline review.");
  },

  reset() {
    this.clearDemoState(); this.state.currentReport = null; document.getElementById("childAlias").value = ""; this.showStep("step-setup");
  },
};

window.addEventListener("DOMContentLoaded", () => { app.clearDemoState(); });
