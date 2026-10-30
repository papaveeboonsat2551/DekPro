// =====================================================================
// หน้าโปรไฟล์ (หน้าหลักหลังล็อกอิน)
// - ดู / แก้ไขข้อมูลส่วนตัว เป้าหมาย และเกรด → บันทึกลงตาราง profiles ทันที
// - คำนวณเกรดเฉลี่ย 5 เทอม เทียบเกณฑ์ และแนะนำมหาลัยอื่นถ้าไม่ถึง
// - เปลี่ยนรหัสผ่านด้วย OTP ทางอีเมล
// =====================================================================

const state = { user: null, profile: null, program: null, programs: [] };

startPage(async () => {
  Object.assign(state, await initPage("profile"));
  state.programs = await loadAllPrograms();

  const wantsEdit = new URLSearchParams(location.search).has("edit");
  render(wantsEdit || !state.profile.first_name);
});

// Supabase ส่งข้อมูลได้ครั้งละ 1000 แถว จึงดึงเป็นหน้าๆ จนครบ
async function loadAllPrograms() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("programs")
      .select("id, university, faculty, major, round, min_gpax")
      .order("id").range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) return all;
  }
}

function render(editing) {
  const { profile, program } = state;
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "ยังไม่ได้ใส่ชื่อ";
  const initial = (profile.first_name || profile.email || "?").charAt(0).toUpperCase();

  $("#app").innerHTML = `
    <section class="card">
      <div class="row">
        <div class="avatar">${esc(initial)}</div>
        <div class="spacer">
          <h1 style="margin:0">${esc(fullName)}</h1>
          <div class="muted small">${esc(profile.school || "ยังไม่ได้ระบุโรงเรียน")}</div>
        </div>
      </div>
      <div class="row mt">
        ${profile.grade_level ? `<span class="badge">${gradeLevelLabel(profile.grade_level)}</span>` : ""}
        ${profile.target_round ? `<span class="badge badge-primary">${ROUND_LABEL[profile.target_round]}</span>` : ""}
        ${program ? `<span class="badge">${esc(program.university)} · ${esc(program.faculty)} · ${esc(program.major)}</span>` : ""}
      </div>
    </section>

    ${editing && !profile.first_name ? `
      <div class="alert alert-info">ยินดีต้อนรับสู่ DekPro! กรอกโปรไฟล์ให้ครบก่อนเริ่มใช้งานนะ</div>` : ""}

    <section class="card">
      <div class="card-header">
        <h2>ข้อมูลส่วนตัวและเป้าหมาย</h2>
        <span class="spacer"></span>
        ${editing ? "" : '<button class="btn btn-ghost btn-sm" type="button" id="edit-btn">แก้ไข (Edit)</button>'}
      </div>
      <form id="profile-form">
        <fieldset class="stack" ${editing ? "" : "disabled"}>
          <div class="grid-2">
            <label class="field"><span>ชื่อ</span>
              <input name="first_name" required value="${esc(profile.first_name)}"></label>
            <label class="field"><span>นามสกุล</span>
              <input name="last_name" required value="${esc(profile.last_name)}"></label>
            <label class="field"><span>ชื่อโรงเรียน</span>
              <input name="school" required value="${esc(profile.school)}"></label>
            <label class="field"><span>อายุ</span>
              <input name="age" type="number" min="10" max="30" required value="${profile.age ?? ""}"></label>
            <label class="field"><span>ตอนนี้เรียนอยู่ชั้น</span>
              <select name="grade_level" required>
                <option value="">— เลือกชั้นและเทอม —</option>
                ${GRADE_LEVELS.map((g) => `<option value="${g.value}" ${g.value === profile.grade_level ? "selected" : ""}>${g.label}</option>`).join("")}
              </select></label>
          </div>

          <div class="field"><span>รอบที่อยากเข้า</span>
            <div class="choice-group">
              ${[2, 3].map((r) => `
                <label class="choice"><input type="radio" name="target_round" value="${r}" required ${profile.target_round === r ? "checked" : ""}><span>${ROUND_LABEL[r]}</span></label>`).join("")}
            </div>
          </div>

          <div class="grid-2">
            <label class="field"><span>มหาวิทยาลัย</span><select name="university" required></select></label>
            <label class="field"><span>คณะ</span><select name="faculty" required></select></label>
            <label class="field"><span>สาขา</span><select name="program_id" required></select></label>
          </div>

          <div id="grades-block" class="stack">
            <h3 style="margin:8px 0 0">เกรดเฉลี่ยแต่ละเทอม</h3>
            <div class="hint"><ul>
              <li>ใส่เกรดได้ตั้งแต่ 1.00 ถึง 4.00</li>
              <li>ถ้าอยู่เทอมนั้นแล้วแต่<b>เกรดยังไม่ออก ให้ใส่ 0.00</b></li>
              <li>มหาลัยดูเกรดเฉลี่ย 5 เทอม (ม.4/1 – ม.6/1) ระบบจะคำนวณให้เมื่อกรอกครบทั้ง 5 เทอม</li>
            </ul></div>
            <div class="grid-3">
              ${GPA_TERMS.map(([key, label]) => `
                <label class="field"><span>${label}</span>
                  <input name="${key}" type="number" step="0.01" min="0" max="4" required value="${Number(profile[key] ?? 0).toFixed(2)}"></label>`).join("")}
            </div>
          </div>
          <p id="grades-note" class="hint">เริ่มกรอกเกรดได้ตั้งแต่ ม.4 เทอม 1 ขึ้นไป</p>
        </fieldset>

        ${editing ? `
          <div class="row mt">
            <button class="btn btn-primary" type="submit">บันทึก</button>
            ${profile.first_name ? '<button class="btn btn-ghost" type="button" id="cancel-btn">ยกเลิก</button>' : ""}
          </div>` : ""}
      </form>
    </section>

    <section class="card" id="gpax-card"></section>

    <section class="card">
      <div class="card-header"><h2>บัญชีผู้ใช้</h2></div>
      <div class="grid-2">
        <label class="field"><span>อีเมลที่ใช้เข้าสู่ระบบ</span>
          <input value="${esc(profile.email)}" disabled></label>
        <div class="field"><span>รหัสผ่าน</span>
          <div class="row" style="flex-wrap:nowrap">
            <input value="••••••••" disabled aria-label="รหัสผ่าน (ซ่อนไว้)">
            <button class="btn btn-ghost" type="button" id="change-pw-btn" style="white-space:nowrap">เปลี่ยนรหัสผ่าน</button>
          </div>
        </div>
      </div>
      <p class="muted small mt" style="margin-bottom:0">ระบบเก็บรหัสผ่านแบบเข้ารหัส จึงไม่มีใครเห็นรหัสเดิมได้ (รวมถึงเจ้าของเว็บ) ถ้าต้องการเปลี่ยน ต้องยืนยันด้วย OTP ทางอีเมลก่อน</p>
    </section>`;

  const form = $("#profile-form");
  bindProgramPickers(form);
  toggleGrades(form);
  renderGpax();

  form.elements.grade_level.addEventListener("change", () => toggleGrades(form));
  $("#edit-btn")?.addEventListener("click", () => render(true));
  $("#cancel-btn")?.addEventListener("click", () => render(false));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    withBusy($("button[type=submit]", form), () => save(form));
  });
  $("#change-pw-btn").addEventListener("click", () => {
    const modal = openModal("เปลี่ยนรหัสผ่าน", "");
    mountPasswordReset(modal.body, { email: state.profile.email, lockEmail: true, onDone: modal.close });
  });
}

// ช่องกรอกเกรดแสดงเฉพาะนักเรียน ม.4 เทอม 1 ขึ้นไป
function toggleGrades(form) {
  const index = GRADE_LEVELS.findIndex((g) => g.value === form.elements.grade_level.value);
  const showGrades = index >= FIRST_GRADE_LEVEL_WITH_GPA;
  $("#grades-block").hidden = !showGrades;
  $("#grades-note").hidden = showGrades;
}

// ตัวเลือก มหาวิทยาลัย → คณะ → สาขา (กรองตามรอบที่เลือก)
function bindProgramPickers(form) {
  const f = form.elements;
  const th = (a, b) => a.localeCompare(b, "th");
  const inRound = () => state.programs.filter((p) => p.round === (Number(f.target_round.value) || null));

  function fill(select, placeholder, options, keep) {
    select.innerHTML = `<option value="">${placeholder}</option>` + options
      .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(keep) ? "selected" : ""}>${esc(o.label)}</option>`)
      .join("");
  }

  function fillUniversities(keep) {
    const names = [...new Set(inRound().map((p) => p.university))].sort(th);
    fill(f.university, f.target_round.value ? "— เลือกมหาวิทยาลัย —" : "— เลือกรอบก่อน —",
      names.map((n) => ({ value: n, label: n })), keep);
  }

  function fillFaculties(keep) {
    const names = [...new Set(inRound().filter((p) => p.university === f.university.value).map((p) => p.faculty))].sort(th);
    fill(f.faculty, f.university.value ? "— เลือกคณะ —" : "— เลือกมหาวิทยาลัยก่อน —",
      names.map((n) => ({ value: n, label: n })), keep);
  }

  function fillMajors(keepId) {
    const list = inRound()
      .filter((p) => p.university === f.university.value && p.faculty === f.faculty.value)
      .sort((a, b) => th(a.major, b.major));
    fill(f.program_id, f.faculty.value ? "— เลือกสาขา —" : "— เลือกคณะก่อน —",
      list.map((p) => ({ value: p.id, label: p.major })), keepId);
  }

  fillUniversities(state.program?.university);
  fillFaculties(state.program?.faculty);
  fillMajors(state.program?.id);

  form.addEventListener("change", (e) => {
    if (e.target.name === "target_round") {
      fillUniversities(f.university.value);
      fillFaculties(f.faculty.value);
      fillMajors(f.program_id.value);
    }
    if (e.target.name === "university") { fillFaculties(null); fillMajors(null); }
    if (e.target.name === "faculty") fillMajors(null);
  });
}

async function save(form) {
  const f = form.elements;
  const updates = {
    first_name: f.first_name.value.trim(),
    last_name: f.last_name.value.trim(),
    school: f.school.value.trim(),
    age: Number(f.age.value) || null,
    grade_level: f.grade_level.value || null,
    target_round: Number(f.target_round.value) || null,
    program_id: Number(f.program_id.value) || null,
    updated_at: new Date().toISOString(),
  };
  for (const [key, label] of GPA_TERMS) {
    const grade = Math.round((Number(f[key].value) || 0) * 100) / 100;
    if (grade !== 0 && (grade < 1 || grade > 4)) {
      throw new Error(`เกรด${label} ต้องเป็น 0.00 (ยังไม่ออก) หรืออยู่ระหว่าง 1.00–4.00`);
    }
    updates[key] = grade;
  }

  const { data, error } = await db.from("profiles").update(updates).eq("id", state.user.id).select().single();
  if (error) throw error;
  state.profile = data;
  state.program = await loadProgram(data.program_id);
  history.replaceState(null, "", "profile.html");
  render(false);
  toast("บันทึกข้อมูลแล้ว", "success");
}

// ---------- เกรดเฉลี่ย 5 เทอม + เทียบเกณฑ์ ----------
function renderGpax() {
  const { profile, program } = state;
  const card = $("#gpax-card");
  const levelIndex = GRADE_LEVELS.findIndex((g) => g.value === profile.grade_level);
  const gpax = calcGpax(profile);
  let body;

  if (levelIndex < FIRST_GRADE_LEVEL_WITH_GPA) {
    body = '<p class="muted" style="margin:0">ระบบจะเริ่มคำนวณเกรดเฉลี่ยเมื่อเรียนถึง ม.4 เทอม 1 ขึ้นไป</p>';
  } else if (gpax === null) {
    body = `
      <div class="alert alert-info">
        <p><b>ยังคำนวณไม่ได้</b> — ต้องมีเกรดครบ 5 เทอม (ม.4/1 ถึง ม.6/1) และทุกเทอมต้องอยู่ระหว่าง 1.00–4.00</p>
        <p>ตอนนี้มีเกรดแล้ว ${countReadyTerms(profile)}/5 เทอม</p>
      </div>`;
  } else {
    const stats = `
      <div class="grid-3" style="margin-bottom:14px">
        <div class="stat"><div class="label">เกรดเฉลี่ย 5 เทอมของคุณ</div><div class="value">${gpax.toFixed(2)}</div></div>
        ${program ? `<div class="stat"><div class="label">เกณฑ์ขั้นต่ำของคณะที่เลือก</div><div class="value">${Number(program.min_gpax).toFixed(2)}</div></div>` : ""}
      </div>`;
    if (!program) {
      body = stats + '<p class="muted">เลือกมหาวิทยาลัยและคณะก่อน จึงจะเทียบเกณฑ์ได้</p>';
    } else if (gpax >= Number(program.min_gpax)) {
      body = stats + `
        <div class="alert alert-ok">
          <p><b>เกรดถึงเกณฑ์แล้ว</b> 🎉 ไปติ๊ก "เกรดเฉลี่ย 5 เทอม (GPAX) ถึงเกณฑ์" ในหน้า <a href="checklist.html">เช็คลิสต์</a> ได้เลย</p>
        </div>`;
    } else {
      const gap = (Number(program.min_gpax) - gpax).toFixed(2);
      body = stats + `
        <div class="alert alert-bad"><p><b>เกรดยังไม่ถึงเกณฑ์</b> (ขาดอีก ${gap})</p></div>
        <h3 class="mt">มหาลัยอื่นที่มีคณะเดียวกัน และเกรดของคุณถึงเกณฑ์</h3>
        ${recommendationsHtml(gpax)}`;
    }
  }

  card.innerHTML = `<div class="card-header"><h2>เกรดเฉลี่ยสะสม 5 เทอม (GPAX)</h2></div>${body}`;

  $$("[data-switch]", card).forEach((btn) =>
    btn.addEventListener("click", () => withBusy(btn, () => switchProgram(Number(btn.dataset.switch)))));
}

function recommendationsHtml(gpax) {
  const current = state.program;
  const options = state.programs
    .filter((p) => p.id !== current.id && p.round === current.round && p.faculty === current.faculty && Number(p.min_gpax) <= gpax)
    .sort((a, b) => (b.major === current.major) - (a.major === current.major) || b.min_gpax - a.min_gpax)
    .slice(0, 8);

  if (!options.length) {
    return '<p class="muted">ยังไม่พบในฐานข้อมูล ลองเปลี่ยนรอบหรือคณะได้ที่ปุ่ม "แก้ไข" ด้านบน</p>';
  }
  return `<div class="stack">${options.map((p) => `
    <div class="row rec-row">
      <div class="spacer">
        <b>${esc(p.university)}</b>
        <div class="muted small">${esc(p.faculty)} · ${esc(p.major)} · ${ROUND_LABEL[p.round]}</div>
      </div>
      <span class="badge badge-ok">เกณฑ์ ${Number(p.min_gpax).toFixed(2)}</span>
      <button class="btn btn-primary btn-sm" type="button" data-switch="${p.id}">เปลี่ยนเป็นที่นี่</button>
    </div>`).join("")}</div>`;
}

async function switchProgram(programId) {
  const { data, error } = await db.from("profiles")
    .update({ program_id: programId, updated_at: new Date().toISOString() })
    .eq("id", state.user.id).select().single();
  if (error) throw error;
  state.profile = data;
  state.program = await loadProgram(programId);
  render(false);
  toast(`เปลี่ยนเป้าหมายเป็น ${state.program.university} แล้ว`, "success");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
