// =====================================================================
// หน้าแผนการอ่าน: นับถอยหลังวันสอบ แยกทีละวิชา
// - วิชาชุดแรกมาจาก "วิชาที่ต้องสอบ" ของคณะที่เลือก (ลบไม่ได้)
// - กด "เพิ่มวิชา" เพื่อเพิ่มวิชาอื่นเองได้ และลบวิชาที่เพิ่มเองได้
//   (เก็บในตาราง exam_dates แถวละวิชา ชื่อวิชาเป็นข้อความ จึงไม่ต้องแก้ฐานข้อมูล)
// =====================================================================

const plan = { user: null, required: [], saved: [] };

// ชื่อวิชาที่แนะนำในกล่อง "เพิ่มวิชา" (พิมพ์ชื่ออื่นเองก็ได้)
const SUBJECT_SUGGESTIONS = [
  "A-Level คณิตศาสตร์ 2", "A-Level ภาษาไทย", "A-Level สังคมศึกษา", "A-Level ชีววิทยา", "A-Level วิทยาศาสตร์ประยุกต์",
  "A-Level ภาษาจีน", "A-Level ภาษาญี่ปุ่น", "A-Level ภาษาฝรั่งเศส", "A-Level ภาษาเยอรมัน", "TPAT2", "TPAT4", "TPAT5",
];

startPage(async () => {
  const { user, program } = await initPage("study-plan");
  if (!program) {
    $("#app").innerHTML = noProgramCard();
    return;
  }
  plan.user = user;
  plan.required = program.program_subjects.map((s) => s.subject);
  await reload();
  render();
  tick();
  setInterval(tick, 1000);
});

async function reload() {
  const { data, error } = await db.from("exam_dates").select("*").eq("user_id", plan.user.id).order("id");
  if (error) throw error;
  plan.saved = data;
}

// วิชาที่ต้องสอบของคณะ + วิชาที่ผู้ใช้เพิ่มเอง (แถวที่ชื่อไม่อยู่ในรายการของคณะ)
function subjectList() {
  const custom = plan.saved.filter((r) => !plan.required.includes(r.subject)).map((r) => r.subject);
  return [
    ...plan.required.map((name) => ({ name, custom: false })),
    ...custom.map((name) => ({ name, custom: true })),
  ];
}

function todayInput() {
  return toLocalInput(new Date()).slice(0, 10);
}

function planCard({ name, custom }) {
  const row = plan.saved.find((r) => r.subject === name);
  return `
    <form class="card stack plan" style="gap:14px" data-subject="${esc(name)}"
          data-start="${row?.start_date ?? ""}" data-exam="${row?.exam_at ?? ""}">
      <div class="plan-head">
        <h2>${esc(name)}</h2>
        ${custom ? '<span class="badge">เพิ่มเอง</span>' : ""}
        <span class="spacer"></span>
        <span data-status></span>
        ${custom ? '<button class="link-danger small" type="button" data-remove>ลบวิชา</button>' : ""}
      </div>
      <div class="cd" data-cd></div>
      <div>
        <div class="progress"><i data-bar></i></div>
        <p class="muted small" data-caption style="margin:6px 0 0"></p>
      </div>
      <div class="grid-2">
        <label class="field"><span>วันที่เริ่มอ่าน</span>
          <input type="date" name="start_date" required value="${row?.start_date ?? todayInput()}"></label>
        <label class="field"><span>วัน-เวลาสอบ</span>
          <input type="datetime-local" name="exam_at" required value="${row ? toLocalInput(row.exam_at) : ""}"></label>
      </div>
      <button class="btn btn-primary btn-sm" type="submit">บันทึก</button>
    </form>`;
}

function render() {
  $("#app").innerHTML = `
    <section class="card">
      <h1>แผนการอ่าน · นับถอยหลังวันสอบ</h1>
      <p class="muted" style="margin:0">ใส่วันที่เริ่มอ่านและวัน-เวลาสอบของแต่ละวิชา แล้วกดบันทึก ระบบจะนับถอยหลังให้แยกทีละวิชา
        ถ้าสอบวิชาอื่นนอกเหนือจากที่คณะกำหนด กด "เพิ่มวิชา" ได้เอง</p>
    </section>
    <div class="plan-grid">
      ${subjectList().map(planCard).join("")}
      <button class="add-card" type="button" id="add-subject">
        <span class="plus" aria-hidden="true">+</span>เพิ่มวิชา
        <span class="small muted" style="font-weight:400">สอบวิชาอื่นนอกเหนือจากที่คณะกำหนด</span>
      </button>
    </div>`;

  $$("form.plan").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      withBusy($("button[type=submit]", form), () => save(form));
    });
    $("[data-remove]", form)?.addEventListener("click", () => removeSubject(form.dataset.subject));
  });
  $("#add-subject").addEventListener("click", openAddDialog);
}

// upsert = ถ้าวิชานี้มีอยู่แล้วให้แก้ไข ถ้ายังไม่มีให้เพิ่มใหม่
async function upsertSubject(subject, startDate, examAt) {
  if (examAt <= new Date(`${startDate}T00:00`)) throw new Error("วันสอบต้องอยู่หลังวันที่เริ่มอ่าน");
  const { error } = await db.from("exam_dates").upsert(
    { user_id: plan.user.id, subject, start_date: startDate, exam_at: examAt.toISOString() },
    { onConflict: "user_id,subject" },
  );
  if (error) throw error;
}

async function save(form) {
  const startDate = form.elements.start_date.value;
  const examAt = new Date(form.elements.exam_at.value);
  await upsertSubject(form.dataset.subject, startDate, examAt);
  form.dataset.start = startDate;
  form.dataset.exam = examAt.toISOString();
  await reload();
  tick();
  toast(`บันทึกวันสอบ ${form.dataset.subject} แล้ว`, "success");
}

function openAddDialog() {
  const taken = subjectList().map((s) => s.name.toLowerCase());
  const suggestions = SUBJECT_SUGGESTIONS.filter((name) => !taken.includes(name.toLowerCase()));
  const { body, close } = openModal("เพิ่มวิชา", `
    <form class="stack" id="add-form">
      <label class="field"><span>ชื่อวิชา</span>
        <input name="subject" list="subject-suggest" required maxlength="60" autocomplete="off" placeholder="เช่น ภาษาจีน หรือเลือกจากรายการ">
        <datalist id="subject-suggest">${suggestions.map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>
        <span class="hint">ชื่อต้องไม่ซ้ำกับวิชาที่มีอยู่แล้ว</span>
      </label>
      <div class="grid-2">
        <label class="field"><span>วันที่เริ่มอ่าน</span><input type="date" name="start_date" required value="${todayInput()}"></label>
        <label class="field"><span>วัน-เวลาสอบ</span><input type="datetime-local" name="exam_at" required></label>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn" type="button" data-cancel>ยกเลิก</button>
        <button class="btn btn-primary" type="submit">เพิ่มวิชา</button>
      </div>
    </form>`);
  const form = $("#add-form", body);
  $("[data-cancel]", form).addEventListener("click", close);
  form.elements.subject.focus();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const subject = form.elements.subject.value.trim().replace(/\s+/g, " ");
    if (!subject) return toast("ใส่ชื่อวิชาก่อน", "error");
    if (taken.includes(subject.toLowerCase())) return toast(`มีวิชา "${subject}" อยู่แล้ว`, "error");
    withBusy($("button[type=submit]", form), async () => {
      await upsertSubject(subject, form.elements.start_date.value, new Date(form.elements.exam_at.value));
      close();
      await reload();
      render();
      tick();
      toast(`เพิ่มวิชา ${subject} แล้ว`, "success");
    });
  });
}

async function removeSubject(name) {
  const row = plan.saved.find((r) => r.subject === name);
  if (!row) return;
  const ok = await confirmModal(`ลบวิชา ${name}?`, "วันสอบและตัวนับถอยหลังของวิชานี้จะถูกลบ (วิชาที่คณะกำหนดลบไม่ได้)", "ลบวิชา");
  if (!ok) return;
  const { error } = await db.from("exam_dates").delete().eq("id", row.id).eq("user_id", plan.user.id);
  if (error) return toast(thaiError(error), "error");
  await reload();
  render();
  tick();
  toast(`ลบวิชา ${name} แล้ว`, "success");
}

// อัปเดตตัวนับถอยหลังทุก 1 วินาที
function tick() {
  const now = Date.now();
  $$("form.plan").forEach((form) => {
    const cd = $("[data-cd]", form);
    const status = $("[data-status]", form);
    const bar = $("[data-bar]", form);
    const caption = $("[data-caption]", form);

    if (!form.dataset.exam) {
      cd.innerHTML = '<div class="cd-empty">ยังไม่ได้ใส่วันสอบ</div>';
      status.innerHTML = "";
      bar.style.width = "0%";
      caption.textContent = "";
      return;
    }

    const exam = new Date(form.dataset.exam).getTime();
    const start = new Date(`${form.dataset.start}T00:00`).getTime();
    const left = Math.max(0, Math.floor((exam - now) / 1000));
    const parts = [
      [Math.floor(left / 86400), "วัน"],
      [Math.floor((left % 86400) / 3600), "ชั่วโมง"],
      [Math.floor((left % 3600) / 60), "นาที"],
      [left % 60, "วินาที"],
    ];
    cd.innerHTML = parts.map(([value, label]) => `<div><b>${value}</b><small>${label}</small></div>`).join("");

    const pct = Math.min(100, Math.max(0, ((now - start) / (exam - start)) * 100));
    const daysSinceStart = Math.max(0, Math.floor((now - start) / 86400000));
    bar.style.width = `${pct}%`;
    bar.parentElement.className = `progress ${left === 0 ? "ok" : parts[0][0] < 7 ? "warn" : ""}`;
    caption.textContent = `เริ่มอ่าน ${formatDate(start)} (ผ่านมา ${daysSinceStart} วัน) · สอบ ${formatDateTime(exam)}`;
    status.innerHTML = left === 0
      ? '<span class="badge badge-ok">สอบแล้ว</span>'
      : parts[0][0] < 7 ? '<span class="badge badge-warn">ใกล้สอบ</span>' : "";
  });
}
