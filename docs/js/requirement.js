// =====================================================================
// หน้าเกณฑ์การรับสมัคร
// - แสดงเกณฑ์ของหลักสูตรที่เลือก: เกรดขั้นต่ำ, วิชาที่ต้องสอบ, สัดส่วน, ขั้นต่ำรายวิชา, รายละเอียดโครงการ
// - แสดงคะแนนสูงสุด-ต่ำสุดของปีก่อน (ตาราง program_score_history) แล้วใช้คำนวณโอกาสติด
// - กรอกคะแนนครบทุกวิชา → คำนวณโอกาสติด (%) เทียบกับคะแนนปีก่อน
// ทำงานได้ทั้งกับฐานข้อมูลแบบเดิม (คะแนนปีก่อนรายวิชา) และแบบใหม่ (คะแนนปีก่อนระดับหลักสูตร)
// =====================================================================

startPage(async () => {
  const { profile, program } = await initPage("requirement");
  if (!program) {
    $("#app").innerHTML = noProgramCard();
    return;
  }
  render(profile, program, await loadHistory(program.id));
});

// ตารางนี้เพิ่มมาทีหลัง: ถ้ายังไม่มีในฐานข้อมูล ให้ข้ามไปเฉยๆ ไม่ให้หน้าพัง
async function loadHistory(programId) {
  try {
    const { data, error } = await db.from("program_score_history").select("*").eq("program_id", programId).order("year", { ascending: false });
    return error ? [] : data;
  } catch {
    return [];
  }
}

// คะแนนรวมแบบถ่วงน้ำหนัก = Σ (คะแนนวิชา × สัดส่วน%) / 100
function weightedTotal(subjects, scoreOf) {
  return subjects.reduce((sum, s) => sum + (Number(scoreOf(s)) || 0) * Number(s.weight_percent) / 100, 0);
}

// โอกาสติดโดยประมาณ เทียบคะแนนรวมกับคะแนนของคนที่ติดปีก่อน
//   ต่ำกว่าคะแนนต่ำสุด     →  1–30%
//   ต่ำสุด ถึง ค่ากลาง      → 30–70%   (ค่ากลาง = (ต่ำสุด+สูงสุด)/2 เมื่อใช้คะแนนปีก่อนระดับหลักสูตร)
//   ตั้งแต่ค่ากลางขึ้นไป    → 70–95% (ไม่ให้ 100% เพราะไม่มีอะไรการันตีได้)
function admissionChance(score, last) {
  if (!last.min || !last.avg) return null;
  if (score < last.min) return Math.max(1, Math.round((30 * score) / last.min));
  if (score < last.avg) return Math.round(30 + (40 * (score - last.min)) / (last.avg - last.min));
  if (last.max <= last.avg) return 90;
  return Math.min(95, Math.round(70 + (25 * (score - last.avg)) / (last.max - last.avg)));
}

const fmt = (n) => (n === null || n === undefined || Number(n) === 0 ? "–" : Number(n).toFixed(2).replace(/\.00$/, ""));
const count = (n) => (n === null || n === undefined || n === "" ? "–" : Number(n).toLocaleString("th-TH"));
// ทำลิงก์ในข้อความให้กดได้ (หลัง esc() แล้วเท่านั้น)
const richText = (text) => esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

function render(profile, program, history) {
  const subjects = program.program_subjects;
  const gpax = calcGpax(profile);
  const minGpax = Number(program.min_gpax);

  // คะแนนปีก่อน: ใช้ระดับหลักสูตรก่อน ถ้าไม่มีใช้ผลรวมรายวิชา (ข้อมูลแบบเดิม)
  const progMin = Number(program.prev_min_score) || 0;
  const progMax = Number(program.prev_max_score) || 0;
  const bySubject = {
    min: weightedTotal(subjects, (s) => s.last_min),
    avg: weightedTotal(subjects, (s) => s.last_avg),
    max: weightedTotal(subjects, (s) => s.last_max),
  };
  const last = progMin
    ? { min: progMin, max: progMax, avg: (progMin + progMax) / 2, year: program.prev_year, level: "program" }
    : { ...bySubject, year: program.data_year, level: bySubject.min ? "subject" : "none" };
  const showLast = subjects.some((s) => Number(s.last_min) > 0);

  // เรียงวิชาจากสัดส่วนคะแนนมากไปน้อย และแบ่งระดับความสำคัญ
  //   สูง: 25% ขึ้นไป (หรือวิชาที่สัดส่วนมากสุดของคณะนั้น ถ้าไม่ต่ำกว่า 20%) · กลาง: 15–24% · ต่ำ: ต่ำกว่า 15%
  const weightOf = (s) => Number(s.weight_percent) || 0;
  const maxWeight = Math.max(...subjects.map(weightOf), 0);
  const tierOf = (s) => {
    const w = weightOf(s);
    return w >= 25 || (w === maxWeight && w >= 20) ? "high" : w >= 15 ? "mid" : "low";
  };
  const byWeight = [...subjects].sort((a, b) => weightOf(b) - weightOf(a) || a.id - b.id);
  const totalWeight = subjects.reduce((sum, s) => sum + weightOf(s), 0);
  // สัดส่วนต้องรวม 100% ถึงคำนวณคะแนนรวมได้ถูกต้อง (บางหลักสูตรมีกติกาคำนวณพิเศษ)
  const canCalc = Math.abs(totalWeight - 100) < 0.5 && last.level !== "none";
  const savedKey = `dekpro.scores.${program.id}`;
  const saved = store.get(savedKey) || {};

  const head = `
    <section class="card">
      <div class="row" style="margin-bottom:10px">
        ${roundBadge(program.round)}
        ${program.is_estimate ? `<span class="badge badge-warn">คาดการณ์จากข้อมูลปี ${program.data_year ?? "ก่อน"}</span>` : `<span class="badge badge-primary">เกณฑ์ปี ${program.data_year ?? ""}</span>`}
        ${program.quota ? `<span class="badge">รับประมาณ ${count(program.quota)} คน</span>` : ""}
      </div>
      <h1>${esc(program.university)}</h1>
      <p class="muted">${esc(program.faculty)} · ${esc(program.major)}</p>
      ${program.is_estimate ? `
        <div class="callout callout-warn">
          <p>ข้อมูลหน้านี้เป็น<b>การคาดการณ์</b> เพราะเกณฑ์ของปีนี้ยังไม่ประกาศ ระบบใช้เกณฑ์และคะแนนของปี ${program.data_year ?? "ก่อน"} ในการวิเคราะห์
          กรุณาตรวจสอบเกณฑ์จริงที่ mytcas.com อีกครั้งเมื่อประกาศ</p>
        </div>` : `
        <div class="callout callout-info">
          <p>เกณฑ์ที่ TCAS ประกาศสำหรับรอบนี้ อาจมีการแก้ไข ตรวจสอบกับมหาวิทยาลัยอีกครั้งก่อนสมัครจริง</p>
        </div>`}
      ${program.note ? `<div class="hint mt" style="white-space:pre-line">${richText(program.note)}</div>` : ""}
    </section>`;

  const gpaxTile = `
      <div class="card stat">
        <div class="label">เกรดเฉลี่ย 5 เทอมขั้นต่ำ</div>
        <div class="value">${minGpax ? minGpax.toFixed(2) : "ไม่กำหนด"}</div>
        <div class="sub">${gpax === null ? "ของคุณ: ยังคำนวณไม่ได้" : minGpax ? `ของคุณ: ${gpax.toFixed(2)} ${gpax >= minGpax ? "✓ ผ่าน" : "✗ ยังไม่ถึง"}` : `ของคุณ: ${gpax.toFixed(2)}`}</div>
      </div>`;
  const scoreTiles = last.level === "none" ? "" : `
      <div class="card stat">
        <div class="label">คะแนนรวมต่ำสุดปีก่อน${last.year ? ` (${last.year})` : ""}</div>
        <div class="value">${last.min ? last.min.toFixed(2) : "–"}</div>
        <div class="sub">ของคนที่ได้รับคัดเลือก เต็ม 100</div>
      </div>
      <div class="card stat">
        <div class="label">${last.level === "program" ? "คะแนนรวมสูงสุดปีก่อน" : "คะแนนรวมเป้าหมาย"}</div>
        <div class="value">${last.level === "program" ? last.max.toFixed(2) : last.avg.toFixed(2)}</div>
        <div class="sub">${last.level === "program" ? "ของคนที่ได้รับคัดเลือก" : "คะแนนเฉลี่ยของคนที่ติดปีก่อน"}</div>
      </div>`;
  const stats = `<section class="grid-3">${gpaxTile}${scoreTiles}</section>`;

  // หลักสูตรที่ไม่มีวิชากลางในเกณฑ์ (เช่น รอบโควตาที่ใช้เกรด/สัมภาษณ์/แฟ้มสะสมผลงาน)
  if (!subjects.length) {
    $("#app").innerHTML = head + stats + `
      <section class="card">
        <div class="callout callout-info">
          <p><b>ไม่มีวิชาสอบกลาง (TGAT / TPAT / A-Level) ระบุไว้ในเกณฑ์ของรายการนี้</b></p>
          <p>ดูเงื่อนไขของโครงการจากรายละเอียดด้านบนและลิงก์ของมหาวิทยาลัย เช่น เกรดเฉลี่ย สัมภาษณ์ แฟ้มสะสมผลงาน หรือการสอบเฉพาะของสถาบัน</p>
        </div>
      </section>`;
    return;
  }

  const historyCard = !history.length ? "" : `
    <section class="card">
      <div class="card-header"><h2>คะแนนของผู้ที่ได้รับคัดเลือก ย้อนหลัง</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ปีการศึกษา</th><th class="r">รับ</th><th class="r">สมัคร</th><th class="r">ผ่าน</th><th class="r">คะแนนต่ำสุด</th><th class="r">คะแนนสูงสุด</th></tr></thead>
          <tbody>
            ${history.map((h) => `
              <tr>
                <td><b>${h.year}</b></td>
                <td class="r num">${count(h.quota)}</td><td class="r num">${count(h.applicants)}</td><td class="r num">${count(h.passed)}</td>
                <td class="r num"><b>${h.min_score_final != null ? Number(h.min_score_final).toFixed(2) : "–"}</b></td>
                <td class="r num">${h.max_score_final != null ? Number(h.max_score_final).toFixed(2) : "–"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="muted small mt" style="margin-bottom:0">คะแนนต่ำสุดคือหลังการประมวลผลครั้งสุดท้าย เทียบข้ามปีได้ตั้งแต่ปี 2567 (เริ่มใช้ TGAT/TPAT/A-Level) และสัดส่วนของแต่ละปีอาจต่างกัน
      ที่มา: ไฟล์คะแนนสูงสุด-ต่ำสุดของ mytcas.com</p>
    </section>`;

  $("#app").innerHTML = head + stats + `
    <section class="card">
      <div class="card-header"><h2>วิชาที่ต้องสอบ เรียงตามสัดส่วนคะแนน</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>วิชา</th>
              <th>สัดส่วนคะแนน</th>
              <th class="r">ขั้นต่ำตามเกณฑ์</th>
              ${showLast ? '<th class="r">ควรได้อย่างน้อย</th><th class="r">เป้าหมาย</th>' : ""}
              <th class="r">คะแนนของคุณ</th>
            </tr>
          </thead>
          <tbody>
            ${byWeight.map((s) => `
              <tr class="w-${tierOf(s)}">
                <td><span class="subject">${esc(s.subject)}</span>${tierOf(s) === "high" ? '<span class="badge badge-solid w-tag">สัดส่วนสูง</span>' : ""}</td>
                <td>${weightOf(s) ? `<div class="w-cell"><span class="w-pct">${fmt(s.weight_percent)}%</span><div class="w-bar"><i style="width:${maxWeight ? (weightOf(s) / maxWeight) * 100 : 0}%"></i></div></div>` : '<span class="muted small">ไม่ระบุสัดส่วน</span>'}</td>
                <td class="r num">${fmt(s.min_score)}</td>
                ${showLast ? `<td class="r num">${fmt(s.last_min)}</td><td class="r num">${fmt(s.last_avg)}</td>` : ""}
                <td class="r"><input type="number" min="0" max="100" step="0.01" inputmode="decimal"
                  data-subject-id="${s.id}" value="${saved[s.id] ?? ""}" aria-label="คะแนน ${esc(s.subject)}"></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="legend mt">
        <span><i style="background:var(--weight-high)"></i>สัดส่วนสูง: สำคัญที่สุด</span>
        <span><i style="background:var(--weight-mid)"></i>15 ถึง 24%</span>
        <span><i style="background:var(--weight-low)"></i>ต่ำกว่า 15%</span>
        <span class="spacer"></span><b>รวม ${fmt(totalWeight)}%</b>
      </div>
      ${showLast ? '<p class="muted small mt">"ควรได้อย่างน้อย" = คะแนนต่ำสุดของคนที่ติดปีก่อน · "เป้าหมาย" = คะแนนเฉลี่ยของคนที่ติดปีก่อน · คะแนนเต็มวิชาละ 100</p>' : '<p class="muted small mt">คะแนนเต็มวิชาละ 100 · "ขั้นต่ำตามเกณฑ์" คือคะแนนที่ต้องได้อย่างน้อยจึงมีสิทธิ์สมัคร</p>'}
      ${!canCalc ? `<div class="callout callout-warn mt"><p>${last.level === "none"
        ? "ยังไม่มีข้อมูลคะแนนปีก่อนของหลักสูตรนี้ จึงยังคำนวณโอกาสติดไม่ได้ (หลักสูตรใหม่หรือไม่เคยเปิดรับในระบบนี้)"
        : `สัดส่วนรวมเป็น ${fmt(totalWeight)}% ไม่ใช่ 100% เพราะหลักสูตรนี้มีกติกาคำนวณพิเศษ (ดูรายละเอียดด้านบน) ระบบจึงไม่คำนวณโอกาสติดให้`}</p></div>` : `
      <div class="hint mt">⚠ ต้อง<b>สอบครบทุกวิชา</b>แล้วค่อยกรอกคะแนน ระบบจึงจะคำนวณโอกาสติดได้</div>`}
      <div class="row mt">
        ${canCalc ? '<button class="btn btn-primary" type="button" id="calc-btn" disabled>คำนวณโอกาสติด</button>' : ""}
        <span class="muted small" id="calc-hint"></span>
      </div>
    </section>` + historyCard;

  const inputs = $$("input[data-subject-id]");
  const calcBtn = $("#calc-btn");

  function readScores() {
    return inputs.map((input) => ({
      subject: subjects.find((s) => s.id === Number(input.dataset.subjectId)),
      raw: input.value,
      score: Number(input.value),
    }));
  }

  function refresh() {
    const scores = readScores();
    const filled = scores.filter((x) => x.raw !== "" && x.score >= 0 && x.score <= 100).length;
    if (calcBtn) calcBtn.disabled = filled < scores.length;
    $("#calc-hint").textContent = filled < scores.length ? `กรอกแล้ว ${filled}/${scores.length} วิชา` : "กรอกครบแล้ว";
    store.set(savedKey, Object.fromEntries(scores.map((x) => [x.subject.id, x.raw])));
  }

  inputs.forEach((input) => input.addEventListener("input", refresh));
  refresh();

  calcBtn?.addEventListener("click", () => {
    const scores = readScores();
    const total = weightedTotal(scores.map((x) => x.subject), (s) => scores.find((x) => x.subject === s).score);
    const belowMin = scores.filter((x) => Number(x.subject.min_score) > 0 && x.score < Number(x.subject.min_score));
    const chance = belowMin.length ? 0 : admissionChance(total, last);
    showResult({ total, chance, belowMin, last, gpax, minGpax });
  });
}

function showResult({ total, chance, belowMin, last, gpax, minGpax }) {
  let level = "bad";
  let message = "โอกาสยังน้อย ลองดูมหาลัยอื่นที่คณะเดียวกันในหน้าโปรไฟล์ หรือเพิ่มคะแนนวิชาที่ยังห่างเป้าหมาย";
  if (chance === null) {
    message = "ยังไม่มีข้อมูลคะแนนปีก่อนของคณะนี้ จึงคำนวณโอกาสไม่ได้";
  } else if (belowMin.length) {
    message = "มีวิชาที่คะแนนต่ำกว่าขั้นต่ำตามเกณฑ์ จึงยังไม่ผ่านเกณฑ์การสมัคร";
  } else if (chance >= 70) {
    level = "ok";
    message = "โอกาสสูง! คะแนนรวมของคุณถึงหรือเกินค่ากลางของคนที่ติดปีก่อน";
  } else if (chance >= 30) {
    level = "warn";
    message = "มีโอกาส คะแนนรวมอยู่ระหว่างคะแนนต่ำสุดกับค่ากลางของคนที่ติดปีก่อน";
  }

  openModal("โอกาสติดโดยประมาณ", `
    <div class="chance">
      <div class="pct">${chance === null ? "–" : `${chance}%`}</div>
      <div class="progress ${level}" style="margin:12px 0"><i style="width:${chance ?? 0}%"></i></div>
    </div>
    <div class="callout callout-${level}"><p>${message}</p></div>
    ${belowMin.length ? `<ul class="small">${belowMin.map((x) =>
      `<li>${esc(x.subject.subject)}: ได้ ${x.score} แต่ขั้นต่ำคือ ${x.subject.min_score}</li>`).join("")}</ul>` : ""}
    <div class="grid-3 mt">
      <div class="stat"><div class="label">คะแนนรวมของคุณ</div><div class="value">${total.toFixed(2)}</div></div>
      <div class="stat"><div class="label">ต่ำสุดปีก่อน</div><div class="value">${last.min.toFixed(2)}</div></div>
      <div class="stat"><div class="label">${last.level === "program" ? "สูงสุดปีก่อน" : "เฉลี่ยปีก่อน"}</div><div class="value">${(last.level === "program" ? last.max : last.avg).toFixed(2)}</div></div>
    </div>
    ${gpax !== null && minGpax && gpax < minGpax ? `<div class="callout callout-bad mt"><p>เกรดเฉลี่ย 5 เทอม (${gpax.toFixed(2)}) ยังไม่ถึงเกณฑ์ ${minGpax.toFixed(2)}</p></div>` : ""}
    <p class="muted small mt" style="margin-bottom:0">ตัวเลขนี้เป็นการคาดการณ์จากคะแนนปีก่อนเท่านั้น ผลจริงขึ้นกับจำนวนผู้สมัครและคะแนนของปีนี้</p>
  `);
}
