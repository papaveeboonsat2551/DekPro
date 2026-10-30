-- =====================================================================
-- DekPro · ขั้นที่ 2: ล้างข้อมูลมหาวิทยาลัย "ตัวอย่าง" ก่อนนำข้อมูลจริงเข้า
-- ⚠ ทำครั้งเดียวก่อน import CSV และ "ย้อนกลับไม่ได้":
--   - เช็คลิสต์ของผู้ใช้ที่สร้างจากข้อมูลตัวอย่างจะถูกลบ (เพราะผูกกับหลักสูตรเดิม)
--   - ผู้ใช้ที่เลือกคณะไว้แล้วจะต้องเลือกใหม่ (ข้อมูลโปรไฟล์อื่นๆ ไม่หาย)
--   - วันสอบ/เวลาอ่านหนังสือ/ผลทำข้อสอบของผู้ใช้ ไม่ถูกแตะต้อง
-- =====================================================================
delete from public.checklist_items;
delete from public.programs;      -- ลบ program_subjects และ program_score_history ตามไปอัตโนมัติ
delete from public.topics;

select (select count(*) from public.programs) as programs,
       (select count(*) from public.program_subjects) as subjects,
       (select count(*) from public.topics) as topics;   -- ต้องได้ 0, 0, 0
