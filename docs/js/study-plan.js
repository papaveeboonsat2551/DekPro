// =====================================================================
// หน้าแผนการอ่าน: นับถอยหลังวันสอบ แยกทีละวิชา
// รายชื่อวิชามาจาก "วิชาที่ต้องสอบ" ของคณะที่เลือก
// =====================================================================

startPage(async () => {
  const { user, program } = await initPage("study-plan");
  if (!program) {
    $("#app").innerHTML = noProgramCard();
    return;
  }
  const { data, error } = await db.from("exam_dates").select("*").eq("user_id", user.id);
  if (error) throw error;
  render(user, program, data);
  tick();
  setInterval(tick, 1000);
});

function render(user, program, saved) {
  const today = toLocalInput(new Date()).slice(0, 10);

  $("#app").innerHTML = `
    <section class="card">
      <h1>แผนการอ่าน · นับถอยหลังวันสอบ</h1>
      <p class="muted" style="margin:0">ใส่วันที่เริ่มอ่านและวัน-เวลาสอบของแต่ละวิชา แล้วกดบันทึก ระบบจะนับถอยหลังให้แยกทีละวิชา</p>
    </section>
    <div class="grid-cards">
      ${program.program_subjects.map((s) => {
        const row = saved.find((r) => r.subject === s.subject);
        return `
          <form class="card stack plan" data-subject="${esc(s.subject)}"
                data-start="${row?.start_date ?? ""}" data-exam="${row?.exam_at ?? ""}">
            <div class="card-header" style="margin:0">
              <h2>${esc(s.subject)}</h2><span class="spacer"></span><span data-status></span>
            </div>
            <div class="cd" data-cd></div>
            <div>
              <div class="progress"><i data-bar></i></div>
              <p class="muted small" data-caption style="margin:6px 0 0"></p>
            </div>
            <div class="grid-2">
              <label class="field"><span>วันที่เริ่มอ่าน</span>
                <input type="date" name="start_date" required value="${row?.start_date ?? today}"></label>
              <label class="field"><span>วัน-เวลาสอบ</span>
                <input type="datetime-local" name="exam_at" required value="${row ? toLocalInput(row.exam_at) : ""}"></label>
            </div>
            <button class="btn btn-primary btn-sm" type="submit">บันทึก</button>
          </form>`;
      }).join("")}
    </div>`;

  $$("form.plan").forEach((form) => form.addEventListener("submit", (e) => {
    e.preventDefault();
    withBusy($("button[type=submit]", form), () => save(user, form));
  }));
}

async function save(user, form) {
  const startDate = form.elements.start_date.value;
  const examAt = new Date(form.elements.exam_at.value);
  if (examAt <= new Date(`${startDate}T00:00`)) throw new Error("วันสอบต้องอยู่หลังวันที่เริ่มอ่าน");

  // upsert = ถ้าวิชานี้มีอยู่แล้วให้แก้ไข ถ้ายังไม่มีให้เพิ่มใหม่
  const { error } = await db.from("exam_dates").upsert(
    { user_id: user.id, subject: form.dataset.subject, start_date: startDate, exam_at: examAt.toISOString() },
    { onConflict: "user_id,subject" },
  );
  if (error) throw error;
  form.dataset.start = startDate;
  form.dataset.exam = examAt.toISOString();
  tick();
  toast(`บันทึกวันสอบ ${form.dataset.subject} แล้ว`, "success");
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
