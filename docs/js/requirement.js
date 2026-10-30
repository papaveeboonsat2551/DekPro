// =====================================================================
// หน้าเกณฑ์การรับสมัคร
// - แสดงเกณฑ์ของคณะที่เลือก: วิชาที่ต้องสอบ, สัดส่วน, คะแนนที่ควรได้
// - กรอกคะแนนครบทุกวิชา → คำนวณโอกาสติด (%) เทียบกับคะแนนปีก่อน
// =====================================================================

startPage(async () => {
  const { profile, program } = await initPage("requirement");
  if (!program) {
    $("#app").innerHTML = noProgramCard();
    return;
  }
  render(profile, program);
});

// คะแนนรวมแบบถ่วงน้ำหนัก = Σ (คะแนนวิชา × สัดส่วน%) / 100
function weightedTotal(subjects, scoreOf) {
  return subjects.reduce((sum, s) => sum + (Number(scoreOf(s)) || 0) * Number(s.weight_percent) / 100, 0);
}

// โอกาสติดโดยประมาณ เทียบคะแนนรวมกับคะแนนของคนที่ติดปีก่อน
//   ต่ำกว่าคะแนนต่ำสุด     →  1–30%
//   ต่ำสุด ถึง ค่าเฉลี่ย    → 30–70%
//   ตั้งแต่ค่าเฉลี่ยขึ้นไป  → 70–95% (ไม่ให้ 100% เพราะไม่มีอะไรการันตีได้)
function admissionChance(score, last) {
  if (!last.min || !last.avg) return null;
  if (score < last.min) return Math.max(1, Math.round((30 * score) / last.min));
  if (score < last.avg) return Math.round(30 + (40 * (score - last.min)) / (last.avg - last.min));
  if (last.max <= last.avg) return 90;
  return Math.min(95, Math.round(70 + (25 * (score - last.avg)) / (last.max - last.avg)));
}

function fmt(n) {
  return n === null || n === undefined || Number(n) === 0 ? "–" : Number(n).toFixed(2).replace(/\.00$/, "");
}

function render(profile, program) {
  const subjects = program.program_subjects;
  const gpax = calcGpax(profile);
  const minGpax = Number(program.min_gpax);
  const last = {
    min: weightedTotal(subjects, (s) => s.last_min),
    avg: weightedTotal(subjects, (s) => s.last_avg),
    max: weightedTotal(subjects, (s) => s.last_max),
  };
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
  const savedKey = `dekpro.scores.${program.id}`;
  const saved = store.get(savedKey) || {};

  $("#app").innerHTML = `
    <section class="card">
      <div class="row" style="margin-bottom:10px">
        ${roundBadge(program.round)}
        ${program.is_estimate ? `<span class="badge badge-warn">คาดการณ์จากข้อมูลปี ${program.data_year ?? "ก่อน"}</span>` : ""}
      </div>
      <h1>${esc(program.university)}</h1>
      <p class="muted">${esc(program.faculty)} · ${esc(program.major)}</p>
      ${program.is_estimate ? `
        <div class="callout callout-warn">
          <p>ข้อมูลหน้านี้เป็น<b>การคาดการณ์</b> เพราะเกณฑ์ของปีนี้ยังไม่ประกาศ ระบบใช้เกณฑ์และคะแนนของปี ${program.data_year ?? "ก่อน"} ในการวิเคราะห์
          กรุณาตรวจสอบเกณฑ์จริงที่ mytcas.com อีกครั้งเมื่อประกาศ</p>
        </div>` : ""}
      ${program.note ? `<p class="muted small mt" style="margin-bottom:0">หมายเหตุ: ${esc(program.note)}</p>` : ""}
    </section>

    <section class="grid-3">
      <div class="card stat">
        <div class="label">เกรดเฉลี่ย 5 เทอมขั้นต่ำ</div>
        <div class="value">${minGpax ? minGpax.toFixed(2) : "ไม่กำหนด"}</div>
        <div class="sub">${gpax === null ? "ของคุณ: ยังคำนวณไม่ได้" : `ของคุณ: ${gpax.toFixed(2)} ${gpax >= minGpax ? "✓ ผ่าน" : "✗ ยังไม่ถึง"}`}</div>
      </div>
      <div class="card stat">
        <div class="label">คะแนนรวมขั้นต่ำที่ควรได้</div>
        <div class="value">${last.min ? last.min.toFixed(2) : "–"}</div>
        <div class="sub">คะแนนต่ำสุดของคนที่ติดปีก่อน</div>
      </div>
      <div class="card stat">
        <div class="label">คะแนนรวมเป้าหมาย</div>
        <div class="value">${last.avg ? last.avg.toFixed(2) : "–"}</div>
        <div class="sub">คะแนนเฉลี่ยของคนที่ติดปีก่อน</div>
      </div>
    </section>

    <section class="card">
      <div class="card-header"><h2>วิชาที่ต้องสอบ เรียงตามสัดส่วนคะแนน</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>วิชา</th>
              <th>สัดส่วนคะแนน</th>
              <th class="r">ขั้นต่ำตามเกณฑ์</th>
              <th class="r">ควรได้อย่างน้อย</th>
              <th class="r">เป้าหมาย</th>
              <th class="r">คะแนนของคุณ</th>
            </tr>
          </thead>
          <tbody>
            ${byWeight.map((s) => `
              <tr class="w-${tierOf(s)}">
                <td><span class="subject">${esc(s.subject)}</span>${tierOf(s) === "high" ? '<span class="badge badge-solid w-tag">สัดส่วนสูง</span>' : ""}</td>
                <td><div class="w-cell"><span class="w-pct">${fmt(s.weight_percent)}%</span><div class="w-bar"><i style="width:${maxWeight ? (weightOf(s) / maxWeight) * 100 : 0}%"></i></div></div></td>
                <td class="r num">${fmt(s.min_score)}</td>
                <td class="r num">${fmt(s.last_min)}</td>
                <td class="r num">${fmt(s.last_avg)}</td>
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
      <p class="muted small mt">"ควรได้อย่างน้อย" = คะแนนต่ำสุดของคนที่ติดปีก่อน · "เป้าหมาย" = คะแนนเฉลี่ยของคนที่ติดปีก่อน · คะแนนเต็มวิชาละ 100</p>
      <div class="hint">⚠ ต้อง<b>สอบครบทุกวิชา</b>แล้วค่อยกรอกคะแนน ระบบจึงจะคำนวณโอกาสติดได้</div>
      <div class="row mt">
        <button class="btn btn-primary" type="button" id="calc-btn" disabled>คำนวณโอกาสติด</button>
        <span class="muted small" id="calc-hint"></span>
      </div>
    </section>`;

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
    calcBtn.disabled = filled < scores.length;
    $("#calc-hint").textContent = filled < scores.length ? `กรอกแล้ว ${filled}/${scores.length} วิชา` : "กรอกครบแล้ว";
    store.set(savedKey, Object.fromEntries(scores.map((x) => [x.subject.id, x.raw])));
  }

  inputs.forEach((input) => input.addEventListener("input", refresh));
  refresh();

  calcBtn.addEventListener("click", () => {
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
    message = "โอกาสสูง! คะแนนรวมของคุณถึงหรือเกินค่าเฉลี่ยของคนที่ติดปีก่อน";
  } else if (chance >= 30) {
    level = "warn";
    message = "มีโอกาส คะแนนรวมอยู่ระหว่างคะแนนต่ำสุดกับค่าเฉลี่ยของคนที่ติดปีก่อน";
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
      <div class="stat"><div class="label">เฉลี่ยปีก่อน</div><div class="value">${last.avg.toFixed(2)}</div></div>
    </div>
    ${gpax !== null && gpax < minGpax ? `<div class="callout callout-bad mt"><p>เกรดเฉลี่ย 5 เทอม (${gpax.toFixed(2)}) ยังไม่ถึงเกณฑ์ ${minGpax.toFixed(2)}</p></div>` : ""}
    <p class="muted small mt" style="margin-bottom:0">ตัวเลขนี้เป็นการคาดการณ์จากคะแนนปีก่อนเท่านั้น ผลจริงขึ้นกับจำนวนผู้สมัครและคะแนนของปีนี้</p>
  `);
}
