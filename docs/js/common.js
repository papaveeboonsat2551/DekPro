// =====================================================================
// ส่วนกลางที่ทุกหน้าใช้ร่วมกัน: ตัวช่วย, เมนู, popup, ตรวจการล็อกอิน,
// ระบบ OTP เปลี่ยนรหัสผ่าน และสูตรคำนวณเกรด
// (ต้องโหลดหลัง api.js เพราะใช้ตัวแปร db)
// =====================================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// กันข้อความที่ผู้ใช้พิมพ์ไม่ให้กลายเป็น HTML
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- ค่าคงที่ ----------
const ROUND_LABEL = { 2: "รอบ 2 Quota", 3: "รอบ 3 Admission" };

const GRADE_LEVELS = [];
for (let year = 1; year <= 6; year++) {
  for (let term = 1; term <= 2; term++) {
    GRADE_LEVELS.push({ value: `${year}/${term}`, label: `ม.${year} เทอม ${term}` });
  }
}
const FIRST_GRADE_LEVEL_WITH_GPA = 6; // ตำแหน่งของ "ม.4 เทอม 1" ใน GRADE_LEVELS

const GPA_TERMS = [
  ["gpa_4_1", "ม.4 เทอม 1"], ["gpa_4_2", "ม.4 เทอม 2"],
  ["gpa_5_1", "ม.5 เทอม 1"], ["gpa_5_2", "ม.5 เทอม 2"],
  ["gpa_6_1", "ม.6 เทอม 1"], ["gpa_6_2", "ม.6 เทอม 2"],
];

// ---------- สูตรเกรด ----------
// เกรดเฉลี่ย 5 เทอม (ม.4/1 – ม.6/1) จะคำนวณก็ต่อเมื่อทุกเทอมอยู่ระหว่าง 1.00–4.00
// ถ้ามีเทอมไหนเป็น 0.00 (เกรดยังไม่ออก) → คืนค่า null = ยังไม่คำนวณ
function calcGpax(profile) {
  const five = GPA_TERMS.slice(0, 5).map(([key]) => Number(profile[key]) || 0);
  if (five.some((g) => g < 1 || g > 4)) return null;
  return Math.round((five.reduce((a, b) => a + b, 0) / 5) * 100) / 100;
}

function countReadyTerms(profile) {
  return GPA_TERMS.slice(0, 5).filter(([key]) => Number(profile[key]) >= 1).length;
}

function gradeLevelLabel(value) {
  return GRADE_LEVELS.find((g) => g.value === value)?.label ?? "";
}

// ---------- รูปแบบเวลา / วันที่ ----------
function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} ชม. ${m} นาที`;
  if (m) return `${m} นาที`;
  return `${s} วินาที`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

// แปลงเวลาเป็นรูปแบบที่ <input type="datetime-local"> ใช้ (ตามเวลาเครื่อง)
function toLocalInput(value) {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------- เก็บค่าในเบราว์เซอร์ (ใช้กับตัวจับเวลา) ----------
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ไม่เป็นไร */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ไม่เป็นไร */ } },
};

// ---------- แจ้งเตือน / popup ----------
function toast(message, type = "info") {
  let wrap = $(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    wrap.setAttribute("role", "status");
    document.body.append(wrap);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.append(el);
  setTimeout(() => el.remove(), 4500);
}

// dismissible: false = ปิดด้วยการกดพื้นหลัง / ปุ่ม × / Esc ไม่ได้
function openModal(title, bodyHtml, { dismissible = true } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        ${dismissible ? '<button class="icon-btn" type="button" aria-label="ปิด" data-close>×</button>' : ""}
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  const onKey = (e) => { if (e.key === "Escape") close(); };
  function close() {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  }
  if (dismissible) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest("[data-close]")) close();
    });
    document.addEventListener("keydown", onKey);
  }
  document.body.append(backdrop);
  return { body: $(".modal-body", backdrop), close };
}

// ---------- แปล error ของ Supabase เป็นภาษาไทย ----------
function thaiError(err) {
  const msg = String(err?.message || err || "");
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("already registered") || m.includes("already been registered")) return "อีเมลนี้มีบัญชีอยู่แล้ว (1 อีเมลสมัครได้ 1 บัญชี)";
  if (m.includes("email not confirmed")) return "บัญชีนี้ยังไม่ได้ยืนยันอีเมล";
  if (m.includes("password should be")) return "รหัสผ่านสั้นหรือง่ายเกินไป";
  if (m.includes("different from the old")) return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม";
  if (m.includes("expired or is invalid") || m.includes("otp")) return "รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว";
  if (m.includes("security purposes") || m.includes("rate limit")) return "ขอรหัสถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (m.includes("error sending") || m.includes("smtp")) return "ส่งอีเมลไม่สำเร็จ — ตรวจการตั้งค่า SMTP ใน Supabase";
  if (m.includes("failed to fetch") || m.includes("networkerror")) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ต หรือค่าใน api.js";
  if (m.includes("jwt") || m.includes("not authenticated")) return "กรุณาเข้าสู่ระบบใหม่";
  return msg || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

// ปิดปุ่มระหว่างรอ และแสดง error เป็นภาษาไทยถ้าทำไม่สำเร็จ
async function withBusy(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (err) {
    console.error(err);
    toast(thaiError(err), "error");
  } finally {
    button.disabled = false;
  }
}

// ---------- การล็อกอิน ----------
async function requireUser() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    location.replace("index.html");
    return new Promise(() => {}); // หยุดโค้ดของหน้านี้ไว้ระหว่างเปลี่ยนหน้า
  }
  return data.session.user;
}

async function redirectIfLoggedIn() {
  const { data } = await db.auth.getSession();
  if (data.session) location.replace("profile.html");
}

async function logout() {
  await db.auth.signOut();
  location.replace("index.html");
}

// ---------- โหลดข้อมูลที่หลายหน้าใช้ ----------
async function loadProfile(userId) {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

async function loadProgram(programId) {
  if (!programId) return null;
  const { data, error } = await db
    .from("programs")
    .select("*, program_subjects(*)")
    .eq("id", programId)
    .single();
  if (error) throw error;
  data.program_subjects.sort((a, b) => a.id - b.id);
  return data;
}

// วิชาเนื้อหาของคณะที่เลือก เช่น คณิตศาสตร์, ฟิสิกส์ (ไม่ซ้ำกัน)
function contentSubjects(program) {
  return [...new Set(program.program_subjects.map((s) => s.content_subject || s.subject))];
}

// ---------- เมนูด้านบน ----------
const ICONS = {
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  requirement: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  checklist: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  "study-plan": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  "study-assist": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  stats: '<path d="M3 21h18M6 17v-5M11 17V7M16 17v-8M21 17V4"/>',
};

const NAV_ITEMS = [
  ["profile", "profile.html", "โปรไฟล์"],
  ["requirement", "requirement.html", "เกณฑ์"],
  ["checklist", "checklist.html", "เช็คลิสต์"],
  ["study-plan", "study-plan.html", "แผนการอ่าน"],
  ["study-assist", "study-assist.html", "จับเวลา"],
  ["stats", "stats.html", "สถิติ"],
];

function svgIcon(paths, className = "") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function renderNav(active) {
  const header = document.createElement("header");
  header.className = "topbar";
  header.innerHTML = `
    <div class="topbar-inner">
      <a class="brand" href="profile.html"><span class="logo">D</span><span>DekPro</span></a>
      <nav class="nav" aria-label="เมนูหลัก">
        ${NAV_ITEMS.map(([key, href, label]) => `
          <a href="${href}" class="${key === active ? "active" : ""}" ${key === active ? 'aria-current="page"' : ""}>
            ${svgIcon(ICONS[key])}<span>${label}</span>
          </a>`).join("")}
      </nav>
      <button class="btn btn-ghost btn-sm" type="button" id="logout-btn">ออกจากระบบ</button>
    </div>`;
  const banner = $(".setup-banner");
  if (banner) banner.after(header);
  else document.body.prepend(header);
  $("#logout-btn").addEventListener("click", logout);
}

// เริ่มหน้า: วาดเมนู → เช็คล็อกอิน → โหลดโปรไฟล์และคณะที่เลือก
async function initPage(activePage) {
  renderNav(activePage);
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  const program = await loadProgram(profile.program_id);
  return { user, profile, program };
}

// รันโค้ดของหน้า ถ้าพังให้แสดงข้อความแทนหน้าว่าง
function startPage(main) {
  main().catch((err) => {
    console.error(err);
    $("#app").innerHTML = `
      <div class="card alert alert-bad">
        <p><b>โหลดข้อมูลไม่สำเร็จ</b></p>
        <p>${esc(thaiError(err))}</p>
      </div>`;
  });
}

function noProgramCard() {
  return `
    <div class="card empty">
      <h2>ยังไม่ได้เลือกเป้าหมาย</h2>
      <p>เลือกรอบ มหาวิทยาลัย และคณะ/สาขาที่อยากเข้าในหน้าโปรไฟล์ก่อนนะ</p>
      <a class="btn btn-primary" href="profile.html?edit=1">ไปที่โปรไฟล์</a>
    </div>`;
}

// ---------- OTP ทางอีเมล + เปลี่ยนรหัสผ่าน ----------
// ใช้ทั้งหน้า "ลืมรหัสผ่าน" และปุ่ม "เปลี่ยนรหัสผ่าน" ในหน้าโปรไฟล์
// ขั้นตอน: ส่ง OTP ไปที่อีเมล → ผู้ใช้กรอก OTP + รหัสใหม่ → ยืนยัน OTP → บันทึกรหัสใหม่ทับรหัสเดิม
function mountPasswordReset(root, { email = "", lockEmail = false, onDone } = {}) {
  root.innerHTML = `
    <form class="stack" data-step="send">
      <label class="field"><span>อีเมลที่ใช้สมัคร</span>
        <input type="email" name="email" required autocomplete="email" value="${esc(email)}" ${lockEmail ? "readonly" : ""}>
      </label>
      <button class="btn btn-primary btn-block" type="submit">ส่งรหัส OTP ไปที่อีเมล</button>
    </form>
    <form class="stack" data-step="verify" hidden>
      <div class="hint">ส่งรหัส OTP ไปที่ <b data-sent-to></b> แล้ว กรุณาเช็คกล่องจดหมาย (รวมถึง Junk / Spam)</div>
      <label class="field"><span>รหัส OTP จากอีเมล</span>
        <input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" required placeholder="เช่น 123456">
      </label>
      <label class="field"><span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</span>
        <input type="password" name="password" minlength="8" required autocomplete="new-password">
      </label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span>
        <input type="password" name="confirm" minlength="8" required autocomplete="new-password">
      </label>
      <button class="btn btn-primary btn-block" type="submit">ยืนยัน OTP และเปลี่ยนรหัสผ่าน</button>
      <button class="btn btn-ghost btn-block" type="button" data-resend disabled>ส่งรหัสอีกครั้ง</button>
    </form>`;

  const sendForm = $('[data-step="send"]', root);
  const verifyForm = $('[data-step="verify"]', root);
  const resendBtn = $("[data-resend]", verifyForm);
  let sentTo = "";
  let cooldown;

  async function sendOtp() {
    // Supabase สุ่มรหัส OTP และส่งเข้าอีเมลให้ (ใช้ template "Reset Password")
    const { error } = await db.auth.resetPasswordForEmail(sentTo);
    if (error) throw error;
    sendForm.hidden = true;
    verifyForm.hidden = false;
    $("[data-sent-to]", verifyForm).textContent = sentTo;
    toast("ส่งรหัส OTP แล้ว กรุณาเช็คอีเมล", "success");

    // ส่งซ้ำได้ทุก 60 วินาที (Supabase จำกัดไว้)
    let left = 60;
    resendBtn.disabled = true;
    clearInterval(cooldown);
    cooldown = setInterval(() => {
      left -= 1;
      resendBtn.textContent = left > 0 ? `ส่งรหัสอีกครั้ง (${left} วินาที)` : "ส่งรหัสอีกครั้ง";
      if (left <= 0) {
        clearInterval(cooldown);
        resendBtn.disabled = false;
      }
    }, 1000);
  }

  sendForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sentTo = sendForm.elements.email.value.trim().toLowerCase();
    withBusy($("button[type=submit]", sendForm), sendOtp);
  });

  resendBtn.addEventListener("click", async () => {
    resendBtn.disabled = true;
    try {
      await sendOtp();
    } catch (err) {
      toast(thaiError(err), "error");
      resendBtn.disabled = false;
    }
  });

  verifyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { otp, password, confirm } = verifyForm.elements;
    if (password.value !== confirm.value) {
      toast("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน", "error");
      return;
    }
    withBusy($("button[type=submit]", verifyForm), async () => {
      const { error: otpError } = await db.auth.verifyOtp({ email: sentTo, token: otp.value.trim(), type: "recovery" });
      if (otpError) throw new Error("รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว");
      // บันทึกรหัสใหม่ → Supabase เข้ารหัสแล้วเขียนทับรหัสเดิมในฐานข้อมูล
      const { error } = await db.auth.updateUser({ password: password.value });
      if (error) throw error;
      clearInterval(cooldown);
      toast("เปลี่ยนรหัสผ่านสำเร็จ", "success");
      onDone?.();
    });
  });
}
