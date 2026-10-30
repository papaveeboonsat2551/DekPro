-- =====================================================================
-- DekPro · ย้ายข้อมูลรอบ 2 จากตารางที่ import ผิดที่ ("programs รอบ 2") เข้าตาราง programs
-- ใช้เมื่อ: ตอน import CSV ไปสร้างตารางใหม่ (เช่น "programs รอบ 2", program_a, program_b)
--           แทนที่จะใส่ในตาราง programs ที่มีอยู่
-- รันใน Supabase → SQL Editor ได้ครั้งเดียวพอ (รันซ้ำก็ไม่ซ้ำแถว เพราะข้าม id ที่มีแล้ว)
-- =====================================================================

insert into public.programs
  (id, university, faculty, major, round, min_gpax, data_year, is_estimate, note,
   tcas_program_id, project_id, project_name, quota, link, prev_year, prev_min_score, prev_max_score)
select
  id::text::bigint,
  university::text,
  faculty::text,
  major::text,
  round::text::int,
  coalesce(nullif(min_gpax::text, '')::numeric, 0),
  nullif(data_year::text, '')::int,
  coalesce(nullif(is_estimate::text, '')::boolean, false),
  nullif(note::text, ''),
  nullif(tcas_program_id::text, ''),
  nullif(project_id::text, ''),
  nullif(project_name::text, ''),
  nullif(quota::text, '')::numeric::int,
  nullif(link::text, ''),
  nullif(prev_year::text, '')::numeric::int,
  nullif(prev_min_score::text, '')::numeric,
  nullif(prev_max_score::text, '')::numeric
from public."programs รอบ 2"
on conflict (id) do nothing;

-- ตรวจ: รอบ 3 = 3255, รอบ 2 = 5193, ไม่มีรหัส TCAS ว่าง = 0
select count(*) filter (where round = 3) as round3,
       count(*) filter (where round = 2) as round2,
       count(*) filter (where tcas_program_id is null) as no_tcas_id
from public.programs;

-- ---------------------------------------------------------------------
-- ขั้นสุดท้าย (รันก็ต่อเมื่อผลตรวจด้านบนถูกแล้ว): ลบตารางที่ import ผิดที่ทิ้ง
-- ข้อมูลทั้งหมดอยู่ในไฟล์ CSV ในเครื่องอยู่แล้ว ลบแล้วไม่เสียอะไร
-- ---------------------------------------------------------------------
-- drop table if exists public."programs รอบ 2";
-- drop table if exists public.program_a;
-- drop table if exists public.program_b;
