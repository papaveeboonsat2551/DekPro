// =====================================================================
// หน้าสถิติ
// - เวลาอ่านหนังสือรวม แยกตามวิชา
// - ผลการทำข้อสอบแต่ละหัวข้อ ครั้งที่ 1, 2, 3, ... และดูว่าพัฒนาขึ้นไหม
// =====================================================================

startPage(async () => {
  const { user } = await initPage("stats");
  const [reading, exams] = await Promise.all([
    db.from("reading_sessions").select("*").eq("user_id", user.id).order("started_at"),
    db.from("exam_sessions").select("*").eq("user_id", user.id).order("attempt_no"),
  ]);
  if (reading.error) throw reading.error;
  if (exams.error) throw exams.error;

  $("#app").innerHTML = `
    <section class="card">
      <h1>สถิติ</h1>
      <p class="muted" style="margin:0">สรุปเวลาอ่านหนังสือ และพัฒนาการการทำข้อสอบของแต่ละหัวข้อ</p>
    </section>
    ${readingHtml(reading.data)}
    <h2 style="margin:8px 4px 0">ผลการทำข้อสอบ</h2>
    ${examsHtml(exams.data)}`;
});

function groupBy(list, keyOf) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function readingHtml(sessions) {
  if (!sessions.length) {
    return `<section class="card empty"><h2>ยังไม่มีเวลาอ่านหนังสือ</h2>
      <p>ไปที่หน้า <a href="study-assist.html">จับเวลา</a> แล้วเลือก "อ่านหนังสือ"</p></section>`;
  }
  const total = sessions.reduce((sum, s) => sum + s.seconds, 0);
  const bySubject = [...groupBy(sessions, (s) => s.subject)]
    .map(([subject, list]) => ({ subject, seconds: list.reduce((sum, s) => sum + s.seconds, 0), count: list.length }))
    .sort((a, b) => b.seconds - a.seconds);
  const longest = bySubject[0].seconds || 1;

  return `
    <section class="card">
      <div class="card-header"><h2>เวลาอ่านหนังสือ</h2></div>
      <div class="grid-3" style="margin-bottom:18px">
        <div class="stat"><div class="label">อ่านรวมทั้งหมด</div><div class="value">${formatDuration(total)}</div></div>
        <div class="stat"><div class="label">จำนวนครั้ง</div><div class="value">${sessions.length}</div></div>
        <div class="stat"><div class="label">เฉลี่ยต่อครั้ง</div><div class="value">${formatDuration(total / sessions.length)}</div></div>
      </div>
      <div class="bars">
        ${bySubject.map((s) => `
          <div class="bar-row">
            <span>${esc(s.subject)}</span>
            <div class="bar"><i style="width:${(s.seconds / longest) * 100}%"></i></div>
            <span class="muted small num">${formatDuration(s.seconds)} · ${s.count} ครั้ง</span>
          </div>`).join("")}
      </div>
    </section>`;
}

function examsHtml(sessions) {
  if (!sessions.length) {
    return `<section class="card empty"><h2>ยังไม่มีผลการทำข้อสอบ</h2>
      <p>ไปที่หน้า <a href="study-assist.html">จับเวลา</a> แล้วเลือก "ทำข้อสอบ"</p></section>`;
  }
  const groups = [...groupBy(sessions, (s) => `${s.subject}\u0000${s.topic}`).values()];
  return `<div class="grid-cards">${groups.map(topicCard).join("")}</div>`;
}

function topicCard(attempts) {
  const { subject, topic } = attempts[0];
  const pctOf = (a) => (a.total_q ? Math.round((a.correct / a.total_q) * 100) : 0);
  const first = pctOf(attempts[0]);
  const latest = pctOf(attempts[attempts.length - 1]);
  const diff = latest - first;

  let trend = '<span class="muted">สอบครั้งเดียว ทำอีกครั้งเพื่อดูพัฒนาการ</span>';
  if (attempts.length > 1) {
    trend = diff > 0 ? `<span class="trend-up">▲ พัฒนาขึ้น ${diff}% จากครั้งแรก</span>`
      : diff < 0 ? `<span class="trend-down">▼ ลดลง ${-diff}% จากครั้งแรก</span>`
      : '<span class="muted">เท่าเดิมกับครั้งแรก</span>';
  }

  return `
    <section class="card">
      <div class="card-header" style="margin-bottom:4px">
        <div class="spacer"><h3 style="margin:0">${esc(topic)}</h3><div class="muted small">${esc(subject)}</div></div>
        <span class="badge badge-primary">สอบแล้ว ${attempts.length} ครั้ง</span>
      </div>
      <div class="small">${trend}</div>
      <div class="spark" aria-hidden="true">
        ${attempts.map((a) => `<i style="height:${Math.max(3, pctOf(a))}%" title="ครั้งที่ ${a.attempt_no}: ${pctOf(a)}%"></i>`).join("")}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ครั้งที่</th><th>วันที่</th><th class="num">เวลา</th><th class="num">ทำได้</th><th class="num">ถูก</th><th class="num">ผิด</th><th class="num">% ถูก</th></tr></thead>
          <tbody>
            ${attempts.map((a, i) => {
              const change = i ? pctOf(a) - pctOf(attempts[i - 1]) : 0;
              const mark = !i ? "" : change > 0 ? ` <span class="trend-up">▲${change}</span>` : change < 0 ? ` <span class="trend-down">▼${-change}</span>` : "";
              return `
                <tr>
                  <td>${a.attempt_no}</td>
                  <td>${formatDate(a.created_at)}</td>
                  <td class="num">${formatClock(a.seconds)}</td>
                  <td class="num">${a.done_q}/${a.total_q}</td>
                  <td class="num">${a.correct}</td>
                  <td class="num">${a.wrong}</td>
                  <td class="num"><b>${pctOf(a)}%</b>${mark}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>`;
}
