// =====================================================================
// หน้าจับเวลา
// - อ่านหนังสือ: เริ่ม → หยุด → บันทึกเวลาลง reading_sessions
// - ทำข้อสอบ: ใส่หัวข้อ → เริ่ม → หยุด → กรอกจำนวนข้อ/ถูก/ผิด → บันทึกลง exam_sessions
// สถานะตัวจับเวลาเก็บในเบราว์เซอร์ด้วย รีเฟรชหน้าแล้วเวลาไม่หาย
// =====================================================================

const TIMER_KEY = "dekpro.timer";
const FALLBACK_SUBJECTS = ["คณิตศาสตร์", "ฟิสิกส์", "เคมี", "ชีววิทยา", "ภาษาไทย", "ภาษาอังกฤษ", "สังคมศึกษา", "TGAT", "TPAT"];

let user;
let mode = "reading";
let timer = store.get(TIMER_KEY); // { mode, subject, topic, startedAt, stoppedAt? }

startPage(async () => {
  const page = await initPage("study-assist");
  user = page.user;
  const subjects = page.program ? contentSubjects(page.program) : FALLBACK_SUBJECTS;
  render(subjects);
  if (timer) mode = timer.mode;
  updateUi();
  loadToday();
  setInterval(updateClock, 250);
  if (timer?.stoppedAt && timer.mode === "exam") askExamResult();
});

function render(subjects) {
  $("#app").innerHTML = `
    <section class="card">
      <h1>จับเวลา</h1>
      <p class="muted" style="margin:0">เลือกวิชา แล้วเลือกว่าจะจับเวลาอ่านหนังสือหรือทำข้อสอบ · ดูผลย้อนหลังได้ที่หน้า <a href="stats.html">สถิติ</a></p>
    </section>

    <section class="card">
      <fieldset class="stack" id="setup">
        <div class="field"><span>ประเภท</span>
          <div class="tabs">
            <button type="button" data-mode="reading">อ่านหนังสือ</button>
            <button type="button" data-mode="exam">ทำข้อสอบ</button>
          </div>
        </div>
        <label class="field"><span>วิชา</span>
          <select name="subject">${subjects.map((s) => `<option>${esc(s)}</option>`).join("")}</select>
        </label>
        <div id="exam-fields" class="stack" hidden>
          <label class="field"><span>ชื่อหัวข้อ / ชุดข้อสอบ</span>
            <input name="topic" list="topic-list" placeholder="เช่น ลอการิทึม" autocomplete="off">
            <datalist id="topic-list"></datalist>
          </label>
          <div id="attempt-info"></div>
        </div>
      </fieldset>

      <div class="center mt">
        <div class="muted" id="timer-label">พร้อมเริ่มจับเวลา</div>
        <div class="timer-display" id="clock">00:00:00</div>
        <div class="row" style="justify-content:center">
          <button class="btn btn-primary btn-lg" type="button" id="start-btn">เริ่มจับเวลา</button>
          <button class="btn btn-danger btn-lg" type="button" id="stop-btn" hidden>หยุดจับเวลา</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>บันทึกของวันนี้</h2></div>
      <div id="today" class="loading">กำลังโหลด...</div>
    </section>`;

  $$("#setup .tabs button").forEach((btn) => btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    updateUi();
  }));
  const subjectSelect = $("#setup select[name=subject]");
  const topicInput = $("#setup input[name=topic]");
  subjectSelect.addEventListener("change", () => { loadTopicSuggestions(); showAttemptInfo(); });
  let debounce;
  topicInput.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(showAttemptInfo, 400);
  });
  $("#start-btn").addEventListener("click", start);
  $("#stop-btn").addEventListener("click", stop);
  loadTopicSuggestions();
}

function updateUi() {
  const running = Boolean(timer);
  $$("#setup .tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  $("#setup").disabled = running;
  $("#exam-fields").hidden = mode !== "exam";
  $("#start-btn").hidden = running;
  $("#stop-btn").hidden = !running;
  $("#clock").classList.toggle("running", running && !timer.stoppedAt);

  if (running) {
    $("#setup select[name=subject]").value = timer.subject;
    $("#setup input[name=topic]").value = timer.topic || "";
    $("#timer-label").textContent = timer.mode === "reading"
      ? `กำลังอ่าน ${timer.subject}`
      : `กำลังทำข้อสอบ ${timer.subject} · ${timer.topic}`;
  } else {
    $("#timer-label").textContent = "พร้อมเริ่มจับเวลา";
    $("#clock").textContent = "00:00:00";
  }
  if (mode === "exam") showAttemptInfo();
}

function updateClock() {
  if (!timer) return;
  const end = timer.stoppedAt || Date.now();
  $("#clock").textContent = formatClock((end - timer.startedAt) / 1000);
}

// ---------- นับครั้งที่สอบหัวข้อเดิม ----------
async function countAttempts(subject, topic) {
  const { count, error } = await db.from("exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("subject", subject).eq("topic", topic);
  if (error) throw error;
  return count;
}

async function showAttemptInfo() {
  const box = $("#attempt-info");
  const subject = $("#setup select[name=subject]").value;
  const topic = $("#setup input[name=topic]").value.trim();
  if (mode !== "exam" || !topic) {
    box.innerHTML = "";
    return;
  }
  try {
    const done = await countAttempts(subject, topic);
    box.innerHTML = done
      ? `<span class="badge badge-primary">หัวข้อนี้เคยสอบแล้ว ${done} ครั้ง · ครั้งนี้เป็นครั้งที่ ${done + 1}</span>`
      : '<span class="badge">สอบหัวข้อนี้ครั้งแรก</span>';
  } catch (err) {
    box.innerHTML = "";
  }
}

async function loadTopicSuggestions() {
  const subject = $("#setup select[name=subject]").value;
  const { data } = await db.from("exam_sessions").select("topic").eq("user_id", user.id).eq("subject", subject);
  const topics = [...new Set((data || []).map((r) => r.topic))];
  $("#topic-list").innerHTML = topics.map((t) => `<option value="${esc(t)}">`).join("");
}

// ---------- เริ่ม / หยุด ----------
function start() {
  const subject = $("#setup select[name=subject]").value;
  const topic = $("#setup input[name=topic]").value.trim();
  if (mode === "exam" && !topic) {
    toast("ใส่ชื่อหัวข้อที่จะทำข้อสอบก่อน", "error");
    $("#setup input[name=topic]").focus();
    return;
  }
  timer = { mode, subject, topic: mode === "exam" ? topic : "", startedAt: Date.now() };
  store.set(TIMER_KEY, timer);
  updateUi();
}

async function stop() {
  timer.stoppedAt ??= Date.now(); // ถ้าเคยกดหยุดแล้วแต่บันทึกไม่สำเร็จ ให้ใช้เวลาเดิม
  store.set(TIMER_KEY, timer);
  updateUi();
  updateClock();
  if (timer.mode === "exam") {
    askExamResult();
    return;
  }
  await withBusy($("#stop-btn"), async () => {
    const seconds = Math.round((timer.stoppedAt - timer.startedAt) / 1000);
    const { error } = await db.from("reading_sessions").insert({
      user_id: user.id,
      subject: timer.subject,
      started_at: new Date(timer.startedAt).toISOString(),
      seconds,
    });
    if (error) throw error;
    toast(`บันทึกเวลาอ่าน ${timer.subject} ${formatDuration(seconds)} แล้ว`, "success");
    clearTimer();
  });
}

function clearTimer() {
  timer = null;
  store.remove(TIMER_KEY);
  updateUi();
  loadToday();
}

// ---------- กรอกผลข้อสอบหลังหยุดเวลา ----------
function askExamResult() {
  const seconds = Math.round((timer.stoppedAt - timer.startedAt) / 1000);
  const modal = openModal("บันทึกผลการทำข้อสอบ", `
    <p class="muted">${esc(timer.subject)} · ${esc(timer.topic)} · ใช้เวลา ${formatDuration(seconds)}</p>
    <form class="stack" id="result-form">
      <div class="grid-2">
        <label class="field"><span>ทำไปได้กี่ข้อ</span><input type="number" name="done_q" min="0" required></label>
        <label class="field"><span>จากทั้งหมดกี่ข้อ</span><input type="number" name="total_q" min="1" required></label>
        <label class="field"><span>ตรวจแล้ว ถูกกี่ข้อ</span><input type="number" name="correct" min="0" required></label>
        <label class="field"><span>ผิดกี่ข้อ</span><input type="number" name="wrong" min="0" required></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">บันทึกผล</button>
      <button class="btn btn-ghost btn-block" type="button" id="discard-btn">ทิ้งรอบนี้ (ไม่บันทึก)</button>
    </form>`, { dismissible: false });

  const form = $("#result-form", modal.body);
  const f = form.elements;
  // ช่วยเติม "ผิด" ให้อัตโนมัติ = ทำได้ − ถูก (แก้เองได้)
  form.addEventListener("input", (e) => {
    if ((e.target === f.correct || e.target === f.done_q) && f.done_q.value && f.correct.value) {
      f.wrong.value = Math.max(0, Number(f.done_q.value) - Number(f.correct.value));
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = {
      done_q: Number(f.done_q.value),
      total_q: Number(f.total_q.value),
      correct: Number(f.correct.value),
      wrong: Number(f.wrong.value),
    };
    if (result.done_q > result.total_q) return toast("จำนวนข้อที่ทำ ต้องไม่เกินจำนวนข้อทั้งหมด", "error");
    if (result.correct + result.wrong > result.done_q) return toast("ถูก + ผิด ต้องไม่เกินจำนวนข้อที่ทำ", "error");

    withBusy($("button[type=submit]", form), async () => {
      const attemptNo = (await countAttempts(timer.subject, timer.topic)) + 1;
      const { error } = await db.from("exam_sessions").insert({
        user_id: user.id,
        subject: timer.subject,
        topic: timer.topic,
        attempt_no: attemptNo,
        seconds,
        ...result,
      });
      if (error) throw error;
      modal.close();
      toast(`บันทึกผล ${timer.topic} ครั้งที่ ${attemptNo} แล้ว`, "success");
      clearTimer();
      loadTopicSuggestions();
    });
  });

  $("#discard-btn", modal.body).addEventListener("click", () => {
    if (!confirm("ทิ้งเวลาของรอบนี้โดยไม่บันทึก?")) return;
    modal.close();
    clearTimer();
  });
}

// ---------- รายการของวันนี้ ----------
async function loadToday() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const since = midnight.toISOString();
  const [reading, exams] = await Promise.all([
    db.from("reading_sessions").select("*").eq("user_id", user.id).gte("started_at", since).order("started_at", { ascending: false }),
    db.from("exam_sessions").select("*").eq("user_id", user.id).gte("created_at", since).order("created_at", { ascending: false }),
  ]);
  const box = $("#today");
  if (reading.error || exams.error) {
    box.textContent = thaiError(reading.error || exams.error);
    return;
  }

  const rows = [
    ...reading.data.map((r) => ({ at: r.started_at, html: `<b>อ่าน ${esc(r.subject)}</b><span class="muted"> · ${formatDuration(r.seconds)}</span>` })),
    ...exams.data.map((x) => ({ at: x.created_at, html: `<b>ข้อสอบ ${esc(x.subject)} · ${esc(x.topic)}</b> <span class="badge">ครั้งที่ ${x.attempt_no}</span><span class="muted"> · ถูก ${x.correct}/${x.total_q} ข้อ · ${formatDuration(x.seconds)}</span>` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const totalReading = reading.data.reduce((sum, r) => sum + r.seconds, 0);
  box.className = "";
  box.innerHTML = rows.length
    ? `<p class="muted small">วันนี้อ่านไปแล้ว ${formatDuration(totalReading)}</p>
       <div class="stack">${rows.map((r) => `<div>${r.html}</div>`).join("")}</div>`
    : '<p class="muted" style="margin:0">วันนี้ยังไม่มีบันทึก เริ่มจับเวลาได้เลย!</p>';
}
