-- =====================================================================
-- DekPro · ข้อมูลตัวอย่างสำหรับทดสอบระบบ (รันหลัง schema.sql)
-- ⚠ ตัวเลขเกณฑ์และคะแนนในไฟล์นี้เป็น "ตัวอย่าง" ไม่ใช่ข้อมูลจริง
--   ให้แทนที่ด้วยข้อมูลจริงจาก mytcas.com / เว็บมหาลัย ก่อนใช้งานจริง
--   (วิธีนำเข้าจาก Excel อยู่ใน README.md)
-- =====================================================================

-- ---------- มหาลัย / คณะ / สาขา ----------
insert into public.programs (id, university, faculty, major, round, min_gpax, data_year, is_estimate, note) values
  (1, 'จุฬาลงกรณ์มหาวิทยาลัย',                 'วิศวกรรมศาสตร์', 'วิศวกรรมโยธา',       3, 3.00, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (2, 'มหาวิทยาลัยเกษตรศาสตร์',                'วิศวกรรมศาสตร์', 'วิศวกรรมโยธา',       3, 2.75, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (3, 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', 'วิศวกรรมศาสตร์', 'วิศวกรรมโยธา',       3, 2.50, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (4, 'มหาวิทยาลัยมหิดล',                      'แพทยศาสตร์',     'แพทยศาสตรบัณฑิต',    3, 3.00, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (5, 'มหาวิทยาลัยเชียงใหม่',                   'แพทยศาสตร์',     'แพทยศาสตรบัณฑิต',    3, 3.00, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (6, 'มหาวิทยาลัยขอนแก่น',                     'แพทยศาสตร์',     'แพทยศาสตรบัณฑิต',    3, 2.75, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (7, 'มหาวิทยาลัยเกษตรศาสตร์',                'วิศวกรรมศาสตร์', 'วิศวกรรมโยธา',       2, 3.25, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'),
  (8, 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', 'วิศวกรรมศาสตร์', 'วิศวกรรมโยธา',       2, 2.75, 2568, true, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ');


-- ---------- วิชาที่ต้องสอบ ----------
-- แต่ละกลุ่มใช้วิชาชุดเดียวกัน ต่างกันที่ระดับคะแนน (k = ตัวคูณความยาก)
-- คอลัมน์ s: วิชาสอบ, วิชาเนื้อหา, สัดส่วน %, ขั้นต่ำ, ต่ำสุดปีก่อน, เฉลี่ยปีก่อน, สูงสุดปีก่อน

-- วิศวะโยธา รอบ 3
insert into public.program_subjects
  (program_id, subject, content_subject, weight_percent, min_score, last_min, last_avg, last_max)
select p.id, s.subject, s.content, s.w, s.min_score,
       round(s.lo * p.k, 2), round(s.mid * p.k, 2), least(100, round(s.hi * p.k, 2))
from (values (1, 1.20), (2, 1.00), (3, 0.90)) as p(id, k)
cross join (values
  ('TGAT',                   'TGAT',        10, 0,  50, 62, 85),
  ('TPAT3',                  'TPAT3',       30, 30, 45, 58, 85),
  ('A-Level คณิตศาสตร์ 1',    'คณิตศาสตร์',  20, 0,  35, 52, 95),
  ('A-Level ฟิสิกส์',          'ฟิสิกส์',      20, 0,  30, 45, 90),
  ('A-Level เคมี',            'เคมี',        10, 0,  30, 45, 85),
  ('A-Level ภาษาอังกฤษ',      'ภาษาอังกฤษ',  10, 0,  40, 58, 95)
) as s(subject, content, w, min_score, lo, mid, hi);

-- แพทย์ รอบ 3
insert into public.program_subjects
  (program_id, subject, content_subject, weight_percent, min_score, last_min, last_avg, last_max)
select p.id, s.subject, s.content, s.w, s.min_score,
       round(s.lo * p.k, 2), round(s.mid * p.k, 2), least(100, round(s.hi * p.k, 2))
from (values (4, 1.10), (5, 1.00), (6, 0.95)) as p(id, k)
cross join (values
  ('TPAT1',                  'TPAT1',        30, 0, 55, 65, 85),
  ('A-Level คณิตศาสตร์ 1',    'คณิตศาสตร์',   14, 0, 50, 65, 95),
  ('A-Level ฟิสิกส์',          'ฟิสิกส์',       9, 0, 45, 60, 95),
  ('A-Level เคมี',            'เคมี',          9, 0, 45, 62, 95),
  ('A-Level ชีววิทยา',        'ชีววิทยา',      9, 0, 50, 65, 95),
  ('A-Level ภาษาไทย',         'ภาษาไทย',       7, 0, 55, 68, 90),
  ('A-Level สังคมศึกษา',       'สังคมศึกษา',    7, 0, 50, 62, 88),
  ('A-Level ภาษาอังกฤษ',      'ภาษาอังกฤษ',   15, 0, 55, 70, 98)
) as s(subject, content, w, min_score, lo, mid, hi);

-- วิศวะโยธา รอบ 2 (Quota)
insert into public.program_subjects
  (program_id, subject, content_subject, weight_percent, min_score, last_min, last_avg, last_max)
select p.id, s.subject, s.content, s.w, s.min_score,
       round(s.lo * p.k, 2), round(s.mid * p.k, 2), least(100, round(s.hi * p.k, 2))
from (values (7, 1.00), (8, 0.90)) as p(id, k)
cross join (values
  ('TGAT',                   'TGAT',        20, 0, 45, 58, 85),
  ('TPAT3',                  'TPAT3',       40, 0, 40, 55, 85),
  ('A-Level คณิตศาสตร์ 1',    'คณิตศาสตร์',  20, 0, 30, 48, 95),
  ('A-Level ฟิสิกส์',          'ฟิสิกส์',      20, 0, 28, 42, 90)
) as s(subject, content, w, min_score, lo, mid, hi);


-- ---------- หัวข้อเนื้อหาสำหรับเช็คลิสต์ ----------
insert into public.topics (subject, topic, sort_order)
select 'คณิตศาสตร์', t, n from unnest(array[
  'เซต', 'ตรรกศาสตร์', 'จำนวนจริงและพหุนาม', 'ฟังก์ชัน', 'เลขยกกำลังและฟังก์ชันเอกซ์โพเนนเชียล',
  'ลอการิทึม', 'เรขาคณิตวิเคราะห์และภาคตัดกรวย', 'ฟังก์ชันตรีโกณมิติ', 'เมทริกซ์', 'เวกเตอร์ในสามมิติ',
  'จำนวนเชิงซ้อน', 'หลักการนับเบื้องต้น', 'ความน่าจะเป็น', 'ลำดับและอนุกรม', 'แคลคูลัสเบื้องต้น',
  'สถิติและการวิเคราะห์ข้อมูล', 'การแจกแจงความน่าจะเป็น'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'ฟิสิกส์', t, n from unnest(array[
  'การเคลื่อนที่แนวตรง', 'แรงและกฎการเคลื่อนที่', 'สมดุลกล', 'งานและพลังงาน', 'โมเมนตัมและการชน',
  'การเคลื่อนที่แนวโค้ง', 'การเคลื่อนที่แบบฮาร์มอนิกอย่างง่าย', 'คลื่นกล', 'เสียง', 'แสงและทัศนอุปกรณ์',
  'ไฟฟ้าสถิต', 'ไฟฟ้ากระแส', 'แม่เหล็กและไฟฟ้า', 'ความร้อนและแก๊ส', 'ของแข็งและของไหล',
  'ฟิสิกส์อะตอม', 'ฟิสิกส์นิวเคลียร์'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'เคมี', t, n from unnest(array[
  'ความปลอดภัยและทักษะในปฏิบัติการเคมี', 'อะตอมและตารางธาตุ', 'พันธะเคมี', 'โมลและสูตรเคมี', 'สารละลาย',
  'ปริมาณสัมพันธ์', 'แก๊สและสมบัติของแก๊ส', 'อัตราการเกิดปฏิกิริยาเคมี', 'สมดุลเคมี', 'กรด-เบส',
  'ไฟฟ้าเคมี', 'เคมีอินทรีย์', 'พอลิเมอร์'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'ชีววิทยา', t, n from unnest(array[
  'เคมีที่เป็นพื้นฐานของสิ่งมีชีวิต', 'เซลล์และการแบ่งเซลล์', 'การถ่ายทอดลักษณะทางพันธุกรรม', 'เทคโนโลยีทางดีเอ็นเอ', 'วิวัฒนาการ',
  'ความหลากหลายทางชีวภาพ', 'โครงสร้างและการทำงานของพืชดอก', 'ระบบย่อยอาหาร', 'ระบบหายใจ', 'ระบบหมุนเวียนเลือดและน้ำเหลือง',
  'ระบบภูมิคุ้มกัน', 'ระบบขับถ่าย', 'ระบบประสาทและอวัยวะรับความรู้สึก', 'ระบบต่อมไร้ท่อ', 'ระบบสืบพันธุ์',
  'พฤติกรรมของสัตว์', 'สิ่งมีชีวิตและสิ่งแวดล้อม'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'ภาษาอังกฤษ', t, n from unnest(array[
  'Vocabulary', 'Grammar: Tenses', 'Grammar: Conditionals', 'Grammar: Passive Voice',
  'Reading Comprehension', 'Conversation', 'Error Identification', 'Sentence Completion'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'ภาษาไทย', t, n from unnest(array[
  'หลักการใช้ภาษา', 'คำและการสร้างคำ', 'ประโยค', 'ระดับภาษา', 'การอ่านจับใจความ',
  'การอ่านเชิงวิเคราะห์', 'การเขียนและเรียงความ', 'วรรณคดีและวรรณกรรม', 'ราชาศัพท์', 'สำนวนและสุภาษิต'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'สังคมศึกษา', t, n from unnest(array[
  'ศาสนา ศีลธรรม จริยธรรม', 'หน้าที่พลเมือง วัฒนธรรม', 'กฎหมาย', 'เศรษฐศาสตร์',
  'ประวัติศาสตร์ไทย', 'ประวัติศาสตร์สากล', 'ภูมิศาสตร์'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'TGAT', t, n from unnest(array[
  'TGAT1 การสื่อสารภาษาอังกฤษ', 'TGAT2 ความสามารถทางภาษา', 'TGAT2 ความสามารถทางตัวเลข',
  'TGAT2 ความสามารถทางมิติสัมพันธ์', 'TGAT2 ความสามารถทางเหตุผล', 'TGAT3 สมรรถนะการทำงาน'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'TPAT1', t, n from unnest(array[
  'เชาวน์ปัญญา', 'จริยธรรมทางการแพทย์', 'ความคิดเชื่อมโยง'
]) with ordinality as x(t, n);

insert into public.topics (subject, topic, sort_order)
select 'TPAT3', t, n from unnest(array[
  'ความรู้ทางวิทยาศาสตร์และเทคโนโลยี', 'ความถนัดทางวิศวกรรม: มิติสัมพันธ์',
  'การแก้ปัญหาเชิงวิศวกรรม', 'ความรู้ทั่วไปทางวิศวกรรมและเทคโนโลยี'
]) with ordinality as x(t, n);
