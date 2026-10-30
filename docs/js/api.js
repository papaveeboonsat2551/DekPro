// =====================================================================
// การเชื่อมต่อกับ Supabase (ฐานข้อมูล + ระบบล็อกอิน)
// ค่า URL และ Key มาจาก docs/js/config.js ซึ่งถูกสร้างจากไฟล์ .env
// (รัน  sh scripts/build-config.sh  ในเครื่อง / Vercel และ GitHub Actions สร้างให้เองตอน deploy)
//
// หมายเหตุ: publishable key ถูกส่งถึงเบราว์เซอร์ของทุกคนโดยออกแบบ ความปลอดภัยของข้อมูล
// มาจาก Row Level Security ในฐานข้อมูล ไม่ได้มาจากการซ่อน key
// ห้ามใช้ secret key / service_role key ที่ไหนในหน้าเว็บเด็ดขาด
// =====================================================================
const _config = window.DEKPRO_CONFIG;
if (!_config || !_config.SUPABASE_URL || !_config.SUPABASE_KEY) {
  document.body.insertAdjacentHTML("afterbegin",
    '<div class="setup-banner">ยังไม่มีไฟล์ docs/js/config.js — รัน  sh scripts/build-config.sh  (ดูวิธีใน README)</div>');
  throw new Error("DEKPRO_CONFIG is missing");
}

const SUPABASE_URL = _config.SUPABASE_URL;
const SUPABASE_KEY = _config.SUPABASE_KEY;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
