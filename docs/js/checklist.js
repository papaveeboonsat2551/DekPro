// =====================================================================
// หน้าเช็คลิสต์ (ทำงานแบบ Google Keep)
// - แยก 2 แบบ: เนื้อหาที่ต้องเก็บ / วิชาที่ต้องสอบ
// - ติ๊กแล้ว → ย้ายลงไปส่วน "ทำแล้ว" ด้านล่าง
// - เอาติ๊กออก → กลับไปอยู่ตำแหน่งเดิม (เพราะเรียงตาม sort_order)
// =====================================================================

let items = [];
let activeKind = "content";

startPage(async () => {
  const { user, program } = await initPage("checklist");
  if (!program) {
    $("#app").innerHTML = noProgramCard();
    return;
  }
  items = await ensureChecklist(user, program);
  renderShell(program);
  renderGroups();
});

// ครั้งแรกที่เปิดหน้านี้กับคณะนี้ → สร้างเช็คลิสต์จากหัวข้อในตาราง topics
async function ensureChecklist(user, program) {
  const { data, error } = await db.from("checklist_items")
    .select("*").eq("user_id", user.id).eq("program_id", program.id).order("sort_order");
  if (error) throw error;
  if (data.length) return data;

  const subjects = contentSubjects(program);
  const { data: topics, error: topicError } = await db.from("topics")
    .select("*").in("subject", subjects).order("sort_order");
  if (topicError) throw topicError;

  const rows = [];
  const add = (kind, subject, title) =>
    rows.push({ user_id: user.id, program_id: program.id, kind, subject, title, sort_order: rows.length });

  for (const subject of subjects) {
    topics.filter((t) => t.subject === subject).forEach((t) => add("content", subject, t.topic));
  }
  if (Number(program.min_gpax) > 0) {
    add("exam", "เกณฑ์ที่ต้องผ่าน", `เกรดเฉลี่ย 5 เทอม (GPAX) ถึงเกณฑ์ ${Number(program.min_gpax).toFixed(2)}`);
  }
  program.program_subjects.forEach((s) => add("exam", "วิชาที่ต้องสอบ", s.subject));

  const { data: created, error: insertError } = await db.from("checklist_items").insert(rows).select();
  if (insertError) throw insertError;
  return created.sort((a, b) => a.sort_order - b.sort_order);
}

function renderShell(program) {
  $("#app").innerHTML = `
    <section class="card">
      <h1>เช็คลิสต์</h1>
      <p class="muted">${esc(program.university)} · ${esc(program.faculty)} · ${esc(program.major)}</p>
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-kind="content">เนื้อหาที่ต้องเก็บ</button>
        <button type="button" role="tab" data-kind="exam">วิชาที่ต้องสอบ</button>
      </div>
      <div class="row mt" id="summary"></div>
      <div class="progress mt"><i id="summary-bar"></i></div>
    </section>
    <div id="groups" class="stack"></div>`;

  $$(".tabs button").forEach((btn) => btn.addEventListener("click", () => {
    activeKind = btn.dataset.kind;
    renderGroups();
  }));

  // ติ๊ก / เอาติ๊กออก → อัปเดตหน้าจอทันที แล้วค่อยบันทึกลงฐานข้อมูล
  $("#groups").addEventListener("change", async (e) => {
    const box = e.target.closest("input[data-id]");
    if (!box) return;
    const item = items.find((i) => i.id === Number(box.dataset.id));
    item.done = box.checked;
    refreshGroup(item.subject);

    const { error } = await db.from("checklist_items")
      .update({ done: item.done, done_at: item.done ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) {
      item.done = !item.done;
      refreshGroup(item.subject);
      toast(thaiError(error), "error");
    }
  });
}

function currentItems() {
  return items.filter((i) => i.kind === activeKind);
}

function renderGroups() {
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.kind === activeKind));
  const list = currentItems();
  const subjects = [...new Set(list.map((i) => i.subject))];

  $("#groups").innerHTML = subjects.length
    ? subjects.map((subject, index) => `
        <details class="card cl-group" data-subject="${esc(subject)}" ${index === 0 || activeKind === "exam" ? "open" : ""}>
          <summary>
            ${svgIcon('<path d="m9 6 6 6-6 6"/>', "chev")}
            <h2>${esc(subject)}</h2>
            <span class="spacer"></span>
            <span class="badge" data-count></span>
          </summary>
          <div class="cl-body"></div>
        </details>`).join("")
    : '<div class="card empty">ยังไม่มีหัวข้อสำหรับคณะนี้ในฐานข้อมูล</div>';

  subjects.forEach(refreshGroup);
  refreshSummary();
}

function refreshGroup(subject) {
  const group = $$(".cl-group").find((el) => el.dataset.subject === subject);
  if (!group) return;
  const byOrder = (a, b) => a.sort_order - b.sort_order;
  const list = currentItems().filter((i) => i.subject === subject);
  const todo = list.filter((i) => !i.done).sort(byOrder);
  const done = list.filter((i) => i.done).sort(byOrder);
  const pct = list.length ? Math.round((done.length / list.length) * 100) : 0;

  $("[data-count]", group).textContent = `${done.length}/${list.length} หัวข้อ`;
  $("[data-count]", group).className = `badge ${done.length === list.length ? "badge-ok" : ""}`;
  $(".cl-body", group).innerHTML = `
    <div class="progress ${pct === 100 ? "ok" : ""}"><i style="width:${pct}%"></i></div>
    <ul class="cl-list">
      ${todo.map(itemHtml).join("") || '<li class="muted small" style="padding:8px">ครบทุกหัวข้อแล้ว เก่งมาก! 🎉</li>'}
    </ul>
    ${done.length ? `
      <details class="cl-done" open>
        <summary>ทำแล้ว ${done.length} รายการ</summary>
        <ul class="cl-list">${done.map(itemHtml).join("")}</ul>
      </details>` : ""}`;
  refreshSummary();
}

function itemHtml(item) {
  return `
    <li>
      <label class="cl-item ${item.done ? "done" : ""}">
        <input type="checkbox" data-id="${item.id}" ${item.done ? "checked" : ""}>
        <span>${esc(item.title)}</span>
      </label>
    </li>`;
}

function refreshSummary() {
  const list = currentItems();
  const subjects = new Set(list.map((i) => i.subject)).size;
  const done = list.filter((i) => i.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  $("#summary").innerHTML = `
    <span class="badge badge-primary">${subjects} ${activeKind === "content" ? "วิชา" : "หมวด"}</span>
    <span class="badge">${list.length} หัวข้อ</span>
    <span class="badge badge-ok">ทำแล้ว ${done} (${pct}%)</span>`;
  $("#summary-bar").style.width = `${pct}%`;
}
