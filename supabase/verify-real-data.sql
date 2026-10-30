-- =====================================================================
-- DekPro · ขั้นสุดท้าย: ตรวจว่านำเข้าครบ (รันหลัง import CSV ครบทุกไฟล์)
-- ค่าที่ควรได้ (ข้อมูลที่สร้างเมื่อ 30 ต.ค. 2569; ถ้ารันสคริปต์ดึงข้อมูลใหม่ ตัวเลขอาจต่างเล็กน้อย):
--   programs_r3 = 3255 | programs_r2 = 5193 | subjects = 8189 | topics = 257 | history = 7931
-- =====================================================================
select
  (select count(*) from public.programs where round = 3) as programs_r3,
  (select count(*) from public.programs where round = 2) as programs_r2,
  (select count(*) from public.program_subjects)         as subjects,
  (select count(*) from public.topics)                   as topics,
  (select count(*) from public.program_score_history)    as history,
  (select count(distinct university) from public.programs) as universities;

-- ตัวอย่าง: จุฬาฯ คณะวิศวกรรมศาสตร์ รอบ 3 ต้องเห็น TGAT 20, TPAT3 30, A-Level คณิต 1 20, ฟิสิกส์ 20, เคมี 10
select p.university, p.faculty, p.major, p.min_gpax, p.prev_year, p.prev_min_score, p.prev_max_score,
       s.subject, s.weight_percent
from public.programs p join public.program_subjects s on s.program_id = p.id
where p.tcas_program_id = '10010121300001A' and p.round = 3
order by s.weight_percent desc;
