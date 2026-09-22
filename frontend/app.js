// Akshara frontend — plain JS, no build step required.
// Point API_BASE at wherever the FastAPI backend is running.
const API_BASE = "https://akshara-backend-4czy.onrender.com";

const app = {
  state: {
    passage: null,
    numeracyTask: null,
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    isRecording: false,
  },

  showStep(id) {
    document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  },

  async startSession() {
    const alias = document.getElementById("childAlias").value.trim();
    if (!alias) { alert("Please enter a child alias or roll number."); return; }
    const language = document.getElementById("language").value;
    this.state.childAlias = alias;
    this.state.language = language;

    const resp = await fetch(`${API_BASE}/api/passage?language=${language}`);
    if (!resp.ok) { alert("Could not load passage from server. Is the backend running?"); return; }
    const data = await resp.json();
    this.state.passage = data.passage;
    this.state.numeracyTask = data.numeracy;

    document.getElementById("passageWords").textContent = data.passage.text;
    document.getElementById("passageText").textContent = data.passage.text;

    this.setupCanvas();
    this.renderNumeracy();
    this.showStep("step-handwriting");
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
    form.append("audio", this.state.audioBlob, "clip.webm");

    const btn = document.querySelector('#step-numeracy .primary');
    btn.disabled = true; btn.textContent = "Analyzing...";

    try {
      const resp = await fetch(`${API_BASE}/api/session/submit`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const report = await resp.json();
      this.renderReport(report);
      this.showStep("step-report");
    } catch (err) {
      alert("Submission failed: " + err.message);
    } finally {
      btn.disabled = false; btn.textContent = "Finish & See Report";
    }
  },

  // ---------- Report rendering ----------
  renderReport(report) {
    const el = document.getElementById("reportContent");
    const riskLabels = { low: "Low concern", watch: "Worth watching", recommend_assessment: "Recommend assessment" };

    const signalRows = (signals) => signals.map(s => `
      <div class="signal-row">
        <span>${s.label.replaceAll("_", " ")}</span>
        <div class="signal-bar-bg"><div class="signal-bar-fill" style="width:${Math.round(s.severity * 100)}%"></div></div>
      </div>`).join("");

    el.innerHTML = `
      <p><strong>${report.child_alias}</strong></p>
      <span class="risk-badge risk-${report.risk.level}">${riskLabels[report.risk.level]}</span>
      <p style="margin-top:14px">${report.risk.summary}</p>
      <p><strong>Suggested next step:</strong> ${report.risk.recommended_next_step}</p>

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
    document.getElementById("childAlias").value = "";
    document.getElementById("recordStatus").textContent = "";
    this.showStep("step-setup");
  },
};
