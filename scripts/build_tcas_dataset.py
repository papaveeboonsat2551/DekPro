#!/usr/bin/env python3
"""สร้างชุดข้อมูล TCAS70 สำหรับ DekPro จากข้อมูลสาธารณะของ mytcas.com

รัน:   python3 scripts/build_tcas_dataset.py            (ใช้ไฟล์ที่ดาวน์โหลดไว้แล้วใน data/raw)
       python3 scripts/build_tcas_dataset.py --refresh   (ดาวน์โหลดใหม่ทั้งหมด)

ใช้เฉพาะไลบรารีมาตรฐานของ Python ไม่ต้องติดตั้งอะไรเพิ่ม

แหล่งข้อมูล (ทุกไฟล์เปิดสาธารณะ ตาม robots.txt ของ mytcas.com):
  - courses.json / universities.json        รายชื่อสถาบัน คณะ หลักสูตร
  - rounds/<รหัสหลักสูตร>.json              เกณฑ์ของแต่ละรอบ (รอบ 2 โควตา, รอบ 3 แอดมิชชัน)
  - ไฟล์ Excel "คะแนนสูงสุด-ต่ำสุด" ของ TCAS67-69 (หน้า /stat)  คะแนนปีก่อน
  - หน้า /blueprint/<วิชา>                  โครงสร้างข้อสอบอย่างเป็นทางการ = หัวข้อที่ต้องอ่าน
ผลลัพธ์อยู่ใน data/tcas70/*.csv (UTF-8 มี BOM เปิดใน Excel ได้ภาษาไทยถูกต้อง)
"""
import ast
import collections
import concurrent.futures as cf
import csv
import gzip
import json
import os
import re
import ssl
import sys
import urllib.request
import zipfile
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "tcas70")
S3 = "https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas"
SITE = "https://www.mytcas.com"
YEAR = 2570
REFRESH = "--refresh" in sys.argv

# Python ที่ติดตั้งจาก python.org ไม่มีใบรับรอง SSL ในตัว: ใช้ของ macOS/Linux แทน
_CA = next((p for p in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt") if os.path.exists(p)), None)
_CTX = ssl.create_default_context(cafile=_CA) if _CA else ssl.create_default_context()


def fetch(url, rel, binary=True):
    """ดาวน์โหลดแล้วเก็บแคชที่ data/raw/<rel> (ถ้ามีแล้วและไม่สั่ง --refresh จะใช้ของเดิม)"""
    path = os.path.join(RAW, rel)
    if not REFRESH and os.path.exists(path):
        data = open(path, "rb").read()
    else:
        req = urllib.request.Request(url, headers={"User-Agent": "DekPro-dataset-builder (student project)"})
        with urllib.request.urlopen(req, timeout=90, context=_CTX) as r:
            data = r.read()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(data)
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    return data if binary else data.decode("utf-8", "replace")


def fetch_json(url, rel):
    return json.loads(fetch(url, rel, binary=False))


def write_csv(name, header, rows):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    # ไฟล์ app_* ใช้นำเข้า Supabase จึงไม่ใส่ BOM (BOM ทำให้ชื่อคอลัมน์แรกเพี้ยน) ส่วนไฟล์อื่นใส่ไว้ให้ Excel เปิดภาษาไทยถูก
    with open(path, "w", newline="", encoding="utf-8" if name.startswith("app_") else "utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"  {name:<30}{len(rows):>8} แถว")


def num(v):
    try:
        if v in (None, ""):
            return None
        x = float(str(v).replace(",", "").strip())
        return int(x) if x == int(x) else round(x, 4)
    except ValueError:
        return None


def count(v):
    """จำนวนคน: ต้องเป็นจำนวนเต็ม (ถ้าไฟล์ต้นทางมีทศนิยมผิดปกติ ถือว่าไม่มีข้อมูล)"""
    n = num(v)
    return int(n) if n is not None and n == int(n) else None


def blank(v):
    return "" if v is None else v


# ----------------------------------------------------------------------------
# 1) แค็ตตาล็อก: สถาบัน / หลักสูตร
# ----------------------------------------------------------------------------
print("1) แค็ตตาล็อกสถาบันและหลักสูตร")
courses = fetch_json(f"{S3}/courses.json", "courses.json")
universities = fetch_json(f"{S3}/universities.json", "universities.json")
by_program = collections.defaultdict(list)
for c in courses:
    by_program[c["program_id"]].append(c)
program_ids = sorted(by_program)
print(f"  {len(universities)} สถาบัน, {len(courses)} หลักสูตร/สาขา ({len(program_ids)} รหัสหลักสูตร)")

# ----------------------------------------------------------------------------
# 2) เกณฑ์ของแต่ละรอบ
# ----------------------------------------------------------------------------
print("2) เกณฑ์แต่ละรอบ (rounds/*.json)")


def get_round(pid):
    try:
        return pid, fetch_json(f"{S3}/rounds/{pid}.json", f"rounds/{pid}.json")
    except Exception as e:  # ไฟล์ของหลักสูตรนี้อาจไม่มี
        return pid, []


with cf.ThreadPoolExecutor(16) as ex:
    rounds = dict(ex.map(get_round, program_ids))
entries = [(pid, e) for pid in program_ids for e in rounds.get(pid, [])]
print(f"  {len(entries)} รายการเกณฑ์ จาก {sum(1 for p in program_ids if rounds.get(p))} หลักสูตร")

# ----------------------------------------------------------------------------
# 3) ตารางรหัสวิชา (a_lv_61 = ?) จากแอปของ mytcas
# ----------------------------------------------------------------------------
print("3) ตารางรหัสวิชา")
labels_path = os.path.join(RAW, "score_labels.json")
if REFRESH or not os.path.exists(labels_path):
    home = fetch("https://course.mytcas.com/", "course-home.html", binary=False)
    chunk = re.search(r'/static/js/main\.[0-9a-f]+\.chunk\.js', home).group(0)
    js = fetch("https://course.mytcas.com" + chunk, "course-main.js", binary=False)
    i = js.index('"key":"gpax5_score"')
    a = js.rfind("JSON.parse('[", 0, i) + len("JSON.parse('")
    b = js.index("]')", i) + 1
    json.dump(json.loads(ast.literal_eval("'" + js[a:b] + "'")), open(labels_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
LABELS = {x["key"]: x for x in json.load(open(labels_path, encoding="utf-8"))}


def category(code):
    if code in ("tgat", "tgat1", "tgat2", "tgat3"):
        return "TGAT"
    if code.startswith("tpat"):
        return "TPAT"
    if code.startswith("a_lv_"):
        return "A-Level"
    if code.startswith("gpa") or code in ("gpax", "gpax5_score", "gpax6_score"):
        return "เกรด (GPA/GPAX)"
    if code in ("portfolio", "interview", "priority_score"):
        return "แฟ้มสะสมผลงาน/สัมภาษณ์/อันดับ"
    if code.startswith("vnet") or code.startswith("netsat") or code.startswith("gsat") or code in ("tbat", "sat", "ged_score"):
        return "การสอบอื่น"
    if re.search(r"(ielts|toefl|toeic|cefr|det|ept|tep|tegs|get|set)", code):
        return "ภาษาอังกฤษ (ผลสอบ)"
    return "วิชาเฉพาะสถาบัน"


SKIP_SCORE_KEYS = {"cal_type", "cal_score_sum", "cal_subject_name"}


def subject_label(code):
    return LABELS.get(code, {}).get("label", code)


# ----------------------------------------------------------------------------
# 4) คะแนนสูงสุด-ต่ำสุดปีก่อน (Excel จากหน้า /stat)
# ----------------------------------------------------------------------------
print("4) คะแนนสูงสุด-ต่ำสุดปีก่อน")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def read_xlsx(data):
    import io
    z = zipfile.ZipFile(io.BytesIO(data))
    shared = [("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)] if "xl/sharedStrings.xml" in z.namelist() else []
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    first = wb.find("m:sheets", NS)[0]
    target = rels[first.get("{%s}id" % NS["r"])].lstrip("/")
    target = target if target.startswith("xl/") else "xl/" + target
    rows = []
    for row in ET.fromstring(z.read(target)).find("m:sheetData", NS):
        vals = {}
        for c in row:
            v = c.find("m:v", NS)
            t = c.get("t")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
            else:
                val = v.text if v is not None else ""
            n = 0
            for ch in re.match(r"[A-Z]+", c.get("r")).group(0):
                n = n * 26 + ord(ch) - 64
            vals[n - 1] = val
        if vals:
            rows.append([vals.get(i, "") for i in range(max(vals) + 1)])
    return rows


HISTORY_FILES = {
    2569: "https://assets.mytcas.com/69/TCAS69-R3-MinMax-10June26.xlsx",
    2568: "https://assets.mytcas.com/68/T68-stat-r3_2-maxmin-24May25.xlsx",
    2567: "https://assets.mytcas.com/67/TCAS67_maxmin.xlsx",
}
history = []  # dict ต่อแถว
for year, url in HISTORY_FILES.items():
    rows = read_xlsx(fetch(url, f"maxmin-{year}.xlsx"))
    head = rows[0]

    def col(*needles, nth=0):
        hits = [i for i, h in enumerate(head) if all(n in h for n in needles)]
        return hits[nth] if len(hits) > nth else None

    c_pid = col("รหัสหลักสูตร")
    c_major = col("รหัสสาขา")
    c_proj = col("รหัสโครงการ")
    exact = lambda name: next((i for i, h in enumerate(head) if h.strip() == name), None)   # ชื่อตรงตัว ("รับ" ไม่ใช่ "รหัสรับร่วม")
    c_quota, c_apply = exact("รับ"), exact("สมัคร")
    if year == 2569:
        c_pass, c_max, c_min = col("ผ่าน"), col("คะแนนสูงสุด"), col("คะแนนต่ำสุด")
        c_max2, c_min2 = col("คะแนนสูงสุด", "DS"), col("คะแนนต่ำสุด", "DS")
        # คอลัมน์แรกที่ชื่อ "คะแนนสูงสุด" อาจเป็นคอลัมน์ DS ถ้า header ซ้อนกัน: เลือกตัวที่ไม่มี DS
        c_max = next(i for i, h in enumerate(head) if h.strip() == "คะแนนสูงสุด")
        c_min = next(i for i, h in enumerate(head) if h.strip() == "คะแนนต่ำสุด")
        c_pass = next(i for i, h in enumerate(head) if h.strip() == "ผ่าน")
    elif year == 2568:
        c_pass = col("ผ่าน", "ครั้งที่ 2")
        c_max, c_min = col("คะแนนสูงสุด", "ครั้งที่ 1"), col("คะแนนต่ำสุด", "ครั้งที่ 1")
        c_max2, c_min2 = col("คะแนนสูงสุด", "ครั้งที่ 2"), col("คะแนนต่ำสุด", "ครั้งที่ 2")
    else:  # 2567
        c_pass = col("ผ่าน(รอบ2)")
        c_max = next(i for i, h in enumerate(head) if h.strip() == "คะแนนสูงสุด")
        c_min = next(i for i, h in enumerate(head) if h.strip() == "คะแนนต่ำสุด")
        c_max2, c_min2 = col("คะแนนสูงสุด", "หลังประมวลผล"), col("คะแนนต่ำสุด", "หลังประมวลผล")
    g = lambda r, c: (r[c] if c is not None and c < len(r) else "")
    for r in rows[1:]:
        if len(r) <= c_pid or not r[c_pid]:
            continue
        mx, mn, mx2, mn2 = num(g(r, c_max)), num(g(r, c_min)), num(g(r, c_max2)), num(g(r, c_min2))
        history.append({
            "year": year, "program_id": r[c_pid], "major_id": (g(r, c_major) or "").replace("0", "") and g(r, c_major) or "",
            "project_id": g(r, c_proj) or "", "quota": count(g(r, c_quota)), "applicants": count(g(r, c_apply)),
            "passed": count(g(r, c_pass)), "min_first": mn, "max_first": mx,
            "min_final": mn2 if mn2 is not None else mn, "max_final": mx2 if mx2 is not None else mx,
        })
print(f"  {len(history)} แถว จากปี {', '.join(str(y) for y in HISTORY_FILES)}")

# ----------------------------------------------------------------------------
# 5) หัวข้อที่ต้องอ่าน จากโครงสร้างข้อสอบ (/blueprint)
# ----------------------------------------------------------------------------
print("5) โครงสร้างข้อสอบ -> หัวข้อสำหรับเช็คลิสต์")
bp_index = fetch(f"{SITE}/blueprint", "blueprint-index.html", binary=False)
slugs = sorted(set(re.findall(r'href="/blueprint/([^"/]+)/"', bp_index)))
SLUG_CODE = {}
for s in slugs:
    m = re.match(r"a-level-(\d+)-", s)
    if m:
        SLUG_CODE[s] = "a_lv_" + m.group(1)
    elif s.startswith("tgat") or s.startswith("tpat"):
        SLUG_CODE[s] = s.split("-")[0]


def page_lines(slug):
    h = fetch(f"{SITE}/blueprint/{slug}/", f"blueprint/{slug}.html", binary=False)
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
    t = re.sub(r"</?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|section|span|strong|b)[^>]*>", "\n", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#8211;", "-")
    lines = [re.sub(r"\s+", " ", x).strip() for x in t.split("\n")]
    lines = [x for x in lines if x]
    i0 = next((i for i, x in enumerate(lines) if x == "โครงสร้างข้อสอบ"), 0)
    i1 = next((i for i, x in enumerate(lines) if x.startswith("ตัวอย่างข้อสอบ") and i > i0), len(lines))
    return lines[i0:i1]


def tidy(t, part=False):
    t = re.sub(r"\s+", " ", t).replace("ประมา ณ", "ประมาณ").replace("– ", "-").strip()
    if part:
        t = re.sub(r"\s*\(\d+\s*คะแนน\)?\s*$", "", t)
    else:
        t = re.sub(r"\s+\d+\s*ข้อ$", "", t)
    t = t.strip()
    if t.count("(") > t.count(")"):      # วงเล็บเปิดค้าง: ปิดให้
        t += ")"
    elif t.count(")") > t.count("("):    # วงเล็บปิดเกิน: ตัดออก
        t = t.rstrip(")").strip()
    return t


def parse_blueprint(lines):
    """คืนค่า [(ลำดับส่วน, ชื่อส่วน, [หัวข้อ...], จำนวนข้อ)]"""
    stop = re.compile(r"^(ประเภทข้อสอบ|ระยะเวลา|หมายเหตุ\s*:?$|จำนวนข้อ$)")
    parts, cur = [], None
    i = 0
    while i < len(lines):
        l = lines[i]
        if stop.match(l) and l.startswith(("ประเภทข้อสอบ", "ระยะเวลา")):
            break
        m = re.match(r"^ส่วนที่\s*(\d+)\s*[:：]?\s*(.*)$", l)
        if m:
            name = m.group(2)
            while i + 1 < len(lines) and not re.match(r"^(\d+\)|จำนวน|ส่วนที่|สมรรถนะ|ประเภทข้อสอบ)", lines[i + 1]) and len(name) < 260:
                i += 1
                name += " " + lines[i]
            cur = {"no": int(m.group(1)), "name": tidy(name, part=True), "topics": [], "q": ""}
            parts.append(cur)
        elif re.match(r"^\d+\.\d+\)\s*", l) and cur is not None and cur["topics"]:
            sub = re.sub(r"^\d+\.\d+\)\s*", "", l)
            cur["topics"][-1] += ": " + re.sub(r"\s*\(\d+\s*ข้อ\)", "", sub)
        elif re.match(r"^\d+\)", l):
            if cur is None:
                cur = {"no": 1, "name": "โครงสร้างข้อสอบ", "topics": [], "q": ""}
                parts.append(cur)
            txt = re.sub(r"^\d+\)\s*", "", l)
            # หัวข้อที่ถูกตัดข้ามบรรทัด เช่น "1) | การถาม | - | ตอบ (Question-Response)"
            j = i + 1
            while j < len(lines) and not re.match(r"^(\d+\)|\d+\.\d+\)|จำนวน|ส่วนที่|ประเภท|หมายเหตุ|ระยะ)", lines[j]) and len(txt) < 120:
                txt += " " + lines[j]
                j += 1
            i = j - 1
            cur["topics"].append(tidy(txt.replace(" - ", "-")))
        elif l.startswith("จำนวน:") and cur is not None:
            nums = []
            j = i + 1
            while j < len(lines) and j < i + 4 and re.match(r"^[\d\s\-–]+$", lines[j]):
                nums.append(lines[j])
                j += 1
            cur["q"] = " ".join(nums).strip()
            i = j - 1
        i += 1
    return [(p["no"], p["name"], p["topics"], p["q"]) for p in parts]


topics_rows, topic_report = [], []
for slug, code in sorted(SLUG_CODE.items()):
    lines = page_lines(slug)
    parts = parse_blueprint(lines)
    n = 0
    for no, pname, tlist, q in parts:
        items = tlist or ([pname] if code in ("tpat4",) else [])
        for t in items:
            n += 1
            topics_rows.append([code, subject_label(code), no, pname if tlist else "", n, t, q, f"{SITE}/blueprint/{slug}/"])
    topic_report.append((code, subject_label(code), len(parts), n))

# TPAT1 (กสพท) ไม่มีหน้า blueprint: ใช้องค์ประกอบ 3 ส่วนจากตารางรหัสวิชาของ TCAS เอง
for n, sub in enumerate(("tpat11", "tpat12", "tpat13"), 1):
    topics_rows.append(["tpat1", subject_label("tpat1"), 1, "องค์ประกอบของ TPAT1", n, re.sub(r"\s*\(TPAT\d+\)", "", subject_label(sub)), "", "ตารางรหัสวิชา TCAS (course.mytcas.com)"])
topic_report.append(("tpat1", subject_label("tpat1"), 1, 3))
# TGAT รวม = TGAT1 + TGAT2 + TGAT3
tgat_n = 0
for r in [x for x in topics_rows if x[0] in ("tgat1", "tgat2", "tgat3")]:
    tgat_n += 1
    topics_rows.append(["tgat", subject_label("tgat"), r[2], f"{r[0].upper()} {r[1]}", tgat_n, r[5], r[6], r[7]])
topic_report.append(("tgat", subject_label("tgat"), 3, tgat_n))

print(f"  {len(slugs)} หน้า blueprint, หัวข้อทั้งหมด {len(topics_rows)} รายการ ใน {len(topic_report)} วิชา")
for code, label, np_, nt in topic_report:
    print(f"    {code:<8}{nt:>4} หัวข้อ  {label[:60]}")

# ----------------------------------------------------------------------------
# 6) สร้างแถวสำหรับแอป (programs / program_subjects / history)
# ----------------------------------------------------------------------------
print("6) จัดรูปแบบให้ตรงกับตารางของแอป")


def clean_program(c):
    name = re.sub(r"^หลักสูตร", "", c.get("program_name_th", "")).strip()
    if c.get("major_name_th") not in (None, "", "0"):
        name += f" (วิชาเอก{c['major_name_th']})" if not c["major_name_th"].startswith("วิชาเอก") else f" ({c['major_name_th']})"
    pt = c.get("program_type_name_th") or ""
    if pt and pt != "ภาษาไทย ปกติ":
        name += f" [{pt}]"
    return name


def pick_course(pid, major_id):
    cs = by_program[pid]
    if major_id and major_id != "0":
        for c in cs:
            if c.get("major_id") == major_id:
                return c
    return next((c for c in cs if c.get("major_id") in (None, "", "0")), cs[0])


def faculty_label(c):
    f = c.get("faculty_name_th") or ""
    camp = c.get("campus_name_th") or ""
    return f if camp in ("", "วิทยาเขตหลัก", "0") else f"{f} ({camp})"


hist_by = collections.defaultdict(list)
for h in history:
    hist_by[h["program_id"]].append(h)


def pick_history(pid, major_id, year):
    rows = [h for h in hist_by.get(pid, []) if h["year"] == year]
    if not rows:
        return None
    exact = [h for h in rows if major_id and h["major_id"] == major_id]
    pool = exact or [h for h in rows if not h["major_id"]] or rows
    pool = [h for h in pool if not h["project_id"]] or pool
    return max(pool, key=lambda h: h["quota"] or 0)


app_programs, app_subjects, app_history, r3_scores, r2_projects, r3_criteria = [], [], [], [], [], []
seen_labels = collections.Counter()
order = sorted(entries, key=lambda t: (by_program[t[0]][0]["university_id"], t[0], t[1]["type"], str(t[1].get("project_id")), str(t[1].get("major_id"))))
next_id = 1
for pid, e in order:
    rnd = int(e["type"].split("_")[0])
    if rnd not in (2, 3):
        continue
    c = pick_course(pid, e.get("major_id"))
    sc = e.get("score_conditions") or {}
    min_gpax = num(e.get("min_gpax")) or num(sc.get("min_gpax")) or 0
    uni, fac, major = c["university_name_th"], faculty_label(c), clean_program(c)
    project = (e.get("project_name_th") or "").strip()
    if rnd == 2 and project:
        major = f"{major} — {project}"
    seen_labels[(uni, fac, major, rnd)] += 1
    if seen_labels[(uni, fac, major, rnd)] > 1:
        major += f" (เกณฑ์ที่ {seen_labels[(uni, fac, major, rnd)]})"
    note_parts = []
    if project:
        note_parts.append(f"โครงการ: {project}" + (f" ({e.get('project_id')})" if e.get("project_id") else ""))
    if (e.get("condition") or "").strip():
        note_parts.append("เงื่อนไข: " + re.sub(r"\s+", " ", e["condition"]).strip())
    if (e.get("description") or "").strip():
        note_parts.append("รายละเอียด: " + re.sub(r"\s+", " ", e["description"]).strip())
    scores = e.get("scores") or {}
    if "cal_type" in scores:
        note_parts.append(f"กติกาพิเศษ: คำนวณคะแนนรวม {scores.get('cal_score_sum', '')}% จากวิชาที่เลือก ({scores.get('cal_subject_name', '')})")
    other_gpa = {k: v for k, v in sc.items() if k.startswith("min_gpa") and k != "min_gpax" and v}
    if other_gpa:
        note_parts.append("เกรดขั้นต่ำรายกลุ่มสาระ: " + ", ".join(f"{subject_label(k[4:])} {v}" for k, v in other_gpa.items()))
    iv = [x.strip() for x in dict.fromkeys([e.get("interview_date") or "", e.get("interview_location") or ""]) if x and x.strip()]   # ตัดข้อความซ้ำ
    if iv:
        note_parts.append("สัมภาษณ์: " + " · ".join(iv))
    if e.get("link"):
        note_parts.append("ลิงก์: " + e["link"])
    note = "\n".join(note_parts)[:1800]

    # ปีก่อน (เฉพาะรอบ 3)
    prev_year = prev_min = prev_max = None
    if rnd == 3:
        for y in (2569, 2568, 2567):
            h = pick_history(pid, e.get("major_id") or "", y)
            if h and h["min_final"] is not None:
                prev_year, prev_min, prev_max = y, h["min_final"], h["max_final"]
                break
        for y in (2569, 2568, 2567):
            h = pick_history(pid, e.get("major_id") or "", y)
            if h:
                app_history.append([next_id, y, 3, blank(h["quota"]), blank(h["applicants"]), blank(h["passed"]), blank(h["min_first"]), blank(h["max_first"]), blank(h["min_final"]), blank(h["max_final"])])
    app_programs.append([next_id, uni, fac, major, rnd, min_gpax, YEAR, "false", note, pid, blank(e.get("project_id")), project, blank(e.get("receive_student_number")), blank(e.get("link")), blank(prev_year), blank(prev_min), blank(prev_max)])

    if rnd == 3:
        r3_criteria.append([next_id, pid, blank(e.get("major_id")), uni, fac, major, min_gpax, blank(num(e.get("min_total_score"))), blank(e.get("receive_student_number")),
                            "ใช่" if "cal_type" in scores else "", blank(e.get("interview_date")), blank(e.get("link")), (e.get("condition") or "").strip().replace("\n", " ")])
        for code, w in scores.items():
            if code in SKIP_SCORE_KEYS:
                continue
            wt = num(w)
            if not wt:
                continue
            minimum = num(sc.get(f"min_{code}"))
            lab = subject_label(code)
            app_subjects.append([next_id, lab, lab if category(code) in ("TGAT", "TPAT", "A-Level") else "", wt, blank(minimum), "", "", ""])
            r3_scores.append([next_id, pid, blank(e.get("major_id")), code, lab, category(code), wt, blank(minimum)])
        # วิชาที่ระบุแค่ "คะแนนขั้นต่ำ" ไม่มีสัดส่วน (ต้องสอบแต่ไม่ได้ระบุน้ำหนัก) เก็บเป็นวิชาสัดส่วน 0 เพื่อให้รู้ว่าต้องสอบอะไร
        have = {k for k, w in scores.items() if num(w)}
        for key, val in sc.items():
            m = re.match(r"^min_(.+)$", key)
            if not m:
                continue
            code = m.group(1)
            if code in have or code not in LABELS or code.startswith("gpa") or code.endswith("_tscore") or not num(val):
                continue
            lab = subject_label(code)
            app_subjects.append([next_id, lab, lab if category(code) in ("TGAT", "TPAT", "A-Level") else "", 0, num(val), "", "", ""])
            r3_scores.append([next_id, pid, blank(e.get("major_id")), code, lab, category(code), 0, num(val)])
    else:
        r2_projects.append([next_id, pid, uni, fac, major, e.get("project_id") or "", project, blank(e.get("receive_student_number")), min_gpax,
                            json.dumps({k: v for k, v in sc.items() if v}, ensure_ascii=False) if sc else "", blank(e.get("interview_date")),
                            blank(e.get("link")), re.sub(r"\s+", " ", e.get("condition") or "").strip(), re.sub(r"\s+", " ", e.get("description") or "").strip()])
    next_id += 1

# ----------------------------------------------------------------------------
# 7) เขียนไฟล์ CSV
# ----------------------------------------------------------------------------
print("7) เขียนไฟล์ CSV ลง data/tcas70/")
camp_ct = collections.Counter(c["university_id"] for c in courses)
write_csv("01_universities.csv",
          ["university_id", "name_th", "name_en", "type_th", "program_count", "accepts_round1", "accepts_round2", "accepts_round3", "accepts_round4"],
          [[u["university_id"], u["university_name"], u.get("university_name_en", ""), next((c["university_type_name_th"] for c in courses if c["university_id"] == u["university_id"]), ""),
            camp_ct.get(u["university_id"], 0), u.get("is_accepted_round1"), u.get("is_accepted_round2"), u.get("is_accepted_round3"), u.get("is_accepted_round4")] for u in universities])
fac_rows = collections.OrderedDict()
for c in courses:
    k = (c["university_id"], c["campus_id"], c["faculty_id"])
    if k not in fac_rows:
        fac_rows[k] = [c["university_id"], c["university_name_th"], c["campus_id"], c["campus_name_th"], c["faculty_id"], c["faculty_name_th"], c.get("faculty_name_en", ""), 0]
    fac_rows[k][7] += 1
write_csv("02_faculties.csv", ["university_id", "university_name_th", "campus_id", "campus_name_th", "faculty_id", "faculty_name_th", "faculty_name_en", "program_count"], list(fac_rows.values()))
write_csv("03_programs.csv",
          ["program_id", "university_id", "university_name_th", "campus_name_th", "faculty_id", "faculty_name_th", "group_field_th", "field_name_th", "program_name_th", "program_name_en",
           "program_type_th", "major_id", "major_name_th", "tuition_text", "graduate_rate", "round2_entries", "round3_entries"],
          [[c["program_id"], c["university_id"], c["university_name_th"], c["campus_name_th"], c["faculty_id"], c["faculty_name_th"], c.get("group_field_th", ""), c.get("field_name_th", ""),
            c.get("program_name_th", ""), c.get("program_name_en", ""), c.get("program_type_name_th", ""), c.get("major_id", ""), c.get("major_name_th", ""),
            re.sub(r"\s+", " ", c.get("cost", "") or ""), c.get("graduate_rate", ""),
            sum(1 for e in rounds.get(c["program_id"], []) if e["type"].startswith("2_")), sum(1 for e in rounds.get(c["program_id"], []) if e["type"].startswith("3_"))] for c in courses])
write_csv("04_round3_admission_criteria.csv",
          ["app_program_id", "program_id", "major_id", "university", "faculty", "program", "min_gpax", "min_total_score", "quota", "special_calc", "interview", "link", "condition"], r3_criteria)
write_csv("05_round3_score_weights.csv", ["app_program_id", "program_id", "major_id", "score_code", "subject_name", "category", "weight_percent", "min_score"], r3_scores)
write_csv("06_round2_quota_projects.csv",
          ["app_program_id", "program_id", "university", "faculty", "program_and_project", "project_id", "project_name", "quota", "min_gpax", "other_conditions_json", "interview", "link", "condition", "description"], r2_projects)
write_csv("07_score_history_min_max.csv",
          ["app_program_id", "year", "round", "quota", "applicants", "passed", "min_score_first", "max_score_first", "min_score_final", "max_score_final"], app_history)
subj_codes = sorted(LABELS, key=lambda k: (category(k), k))
write_csv("08_score_codes.csv", ["code", "label_th", "category", "max_value"], [[k, LABELS[k]["label"], category(k), LABELS[k].get("max_value", "")] for k in subj_codes])
write_csv("09_study_topics.csv", ["subject_code", "subject_name", "part_no", "part_name", "topic_no", "topic", "questions", "source"], topics_rows)
# ---- ไฟล์ที่ตรงกับตารางของแอป (นำเข้าได้ทันที) ----
APP_PROGRAM_HEADER = ["id", "university", "faculty", "major", "round", "min_gpax", "data_year", "is_estimate", "note", "tcas_program_id", "project_id", "project_name", "quota", "link", "prev_year", "prev_min_score", "prev_max_score"]
write_csv("app_programs_round3.csv", APP_PROGRAM_HEADER, [r for r in app_programs if r[4] == 3])
write_csv("app_programs_round2.csv", APP_PROGRAM_HEADER, [r for r in app_programs if r[4] == 2])
write_csv("app_program_subjects.csv", ["program_id", "subject", "content_subject", "weight_percent", "min_score", "last_min", "last_avg", "last_max"], app_subjects)
write_csv("app_topics.csv", ["subject", "topic", "sort_order"], [[r[1], r[5], i] for i, r in enumerate(topics_rows, 1)])
write_csv("app_score_history.csv", ["program_id", "year", "round", "quota", "applicants", "passed", "min_score_first", "max_score_first", "min_score_final", "max_score_final"], app_history)

r3n = sum(1 for r in app_programs if r[4] == 3)
print(f"\nสรุป: โปรแกรมในแอป {len(app_programs)} แถว (รอบ 3 = {r3n}, รอบ 2 = {len(app_programs) - r3n}), "
      f"วิชา/สัดส่วน {len(app_subjects)} แถว, คะแนนปีก่อน {len(app_history)} แถว, หัวข้ออ่าน {len(topics_rows)} หัวข้อ")
print("รอบ 3 ที่มีคะแนนปีก่อน:", sum(1 for r in app_programs if r[4] == 3 and r[14] != ""), "จาก", r3n)
