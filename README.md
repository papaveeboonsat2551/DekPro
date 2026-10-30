# DekPro — เว็บวางแผนเรียนต่อมหาวิทยาลัย (TCAS)

เว็บช่วยนักเรียน ม.ปลาย วางแผนเข้ามหาลัยรอบ 2 (Quota) และรอบ 3 (Admission)

- **Live URL:** [https://dekpro-delta.vercel.app](https://dekpro-delta.vercel.app)
- **Source Code:** [https://github.com/papaveeboonsat2551/DekPro](https://github.com/papaveeboonsat2551/DekPro)

## ฟีเจอร์

| หน้า | ทำอะไรได้ |
|---|---|
| เข้าสู่ระบบ / สร้างบัญชี | สมัครด้วยอีเมล + รหัสผ่าน (1 อีเมล = 1 บัญชี) |
| ลืมรหัสผ่าน | ยืนยันตัวตนด้วย OTP ที่ส่งเข้าอีเมลจริง แล้วตั้งรหัสใหม่ (รหัสใหม่เขียนทับรหัสเดิม) |
| โปรไฟล์ | ข้อมูลส่วนตัว, ชั้น/เทอม, รอบ, มหาลัย/คณะ, เกรด 6 เทอม, คำนวณ GPAX 5 เทอม, เทียบเกณฑ์, แนะนำมหาลัยอื่น, เปลี่ยนรหัสผ่านด้วย OTP |
| เกณฑ์ | วิชาที่ต้องสอบ, สัดส่วน, คะแนนที่ควรได้, กรอกคะแนนแล้วคำนวณ % โอกาสติด |
| เช็คลิสต์ | หัวข้อเนื้อหาที่ต้องเก็บ + วิชาที่ต้องสอบ ติ๊กแล้วย้ายลงล่างแบบ Google Keep |
| แผนการอ่าน | ใส่วันเริ่มอ่าน/วันสอบ แล้วนับถอยหลังแยกทีละวิชา |
| จับเวลา | จับเวลาอ่านหนังสือ / ทำข้อสอบ (บันทึกจำนวนข้อ ถูก ผิด และครั้งที่สอบ) |
| สถิติ | เวลาอ่านรวมแต่ละวิชา และพัฒนาการคะแนนของแต่ละหัวข้อ |

## Tech stack

- **Frontend:** HTML / CSS / JavaScript ล้วน (โฟลเดอร์ `docs/`) — deploy บน GitHub Pages
- **Database + ระบบล็อกอิน + ส่งอีเมล OTP:** [Supabase](https://supabase.com) (PostgreSQL)

## โครงสร้างไฟล์

```
docs/                      ← หน้าเว็บทั้งหมด (GitHub Pages เสิร์ฟจากโฟลเดอร์นี้)
├── index.html             เข้าสู่ระบบ
├── register.html          สร้างบัญชี
├── forgot.html            ลืมรหัสผ่าน (OTP)
├── profile.html           โปรไฟล์ (หน้าหลักหลังล็อกอิน)
├── requirement.html       เกณฑ์การรับสมัคร
├── checklist.html         เช็คลิสต์
├── study-plan.html        แผนการอ่าน / นับถอยหลัง
├── study-assist.html      จับเวลา
├── stats.html             สถิติ
├── css/style.css          ดีไซน์ของทุกหน้า
└── js/
    ├── api.js             สร้างตัวเชื่อม Supabase (อ่านค่าจาก config.js)
    ├── config.js          ← สร้างอัตโนมัติจาก .env (ไม่อยู่ใน Git)
    ├── common.js          โค้ดส่วนกลาง (เมนู, popup, ล็อกอิน, OTP, สูตรเกรด)
    ├── auth.js            หน้า login / สมัคร / ลืมรหัส
    └── <ชื่อหน้า>.js       โค้ดของแต่ละหน้า (1 หน้า = 1 ไฟล์)
supabase/
├── schema.sql             สร้างตารางทั้งหมด + สิทธิ์การเข้าถึง
├── seed.sql               ข้อมูลตัวอย่าง (มหาลัย, วิชา, หัวข้อ)
└── email-reset-password.html   template อีเมล OTP
```

## ตารางในฐานข้อมูล

| กลุ่ม | ตาราง | เก็บอะไร |
|---|---|---|
| Uni & Requirement | `programs`, `program_subjects`, `topics` | มหาลัย คณะ สาขา เกณฑ์ วิชาที่ต้องสอบ คะแนนปีก่อน หัวข้อเนื้อหา |
| User | `auth.users` (ของ Supabase), `profiles` | อีเมล รหัสผ่าน (เข้ารหัสแล้ว) และข้อมูลโปรไฟล์ทั้งหมด |
| Checklist | `checklist_items` | หัวข้อของผู้ใช้แต่ละคน + ติ๊กแล้วหรือยัง |
| Study Plan | `exam_dates` | วันเริ่มอ่าน และวัน-เวลาสอบ แต่ละวิชา |
| Study Assist | `reading_sessions`, `exam_sessions` | เวลาอ่าน, ผลการทำข้อสอบแต่ละครั้ง |

---

## วิธีตั้งค่า (ทำครั้งเดียว)

### 1. สร้างโปรเจกต์ Supabase
1. สมัครที่ supabase.com → **New project** (เลือก Region: Singapore)
2. เมนู **SQL Editor** → New query → วางเนื้อหาไฟล์ `supabase/schema.sql` → **Run**
3. New query อีกอัน → วาง `supabase/seed.sql` → **Run**
4. New query อีกอัน → วาง `supabase/seed-more.sql` → **Run** (เพิ่มประมาณ 21 มหาวิทยาลัย / 940 หลักสูตร ข้อมูลตัวอย่าง รันซ้ำได้ไม่ซ้ำข้อมูล)

> ล้างช่อง SQL Editor ให้ว่างก่อนวางทุกครั้ง ไม่เช่นนั้นโค้ดเก่าจะถูกรันซ้ำ

### 2. ตั้งค่าระบบล็อกอิน
1. **Authentication → Sign In / Providers → Email** → ปิด **Confirm email** → Save
   (สมัครแล้วเข้าใช้ได้ทันที)
2. **Authentication → Emails → Templates → Reset Password**
   - Subject: `รหัส OTP สำหรับเปลี่ยนรหัสผ่าน DekPro`
   - Body: วางเนื้อหาไฟล์ `supabase/email-reset-password.html` (มี `{{ .Token }}` = รหัส OTP)
   - วางในแท็บ **Source** (ไม่ใช่ Preview) แล้วกด **Save changes** ทุกครั้ง
   - ถ้าอีเมลที่ได้รับเป็น "ลิงก์ Reset password" แทนรหัส 6 หลัก แปลว่า template ยังไม่ถูกบันทึก (ดูหัวข้อแก้ปัญหาท้ายไฟล์)

### 3. ตั้งค่าให้ส่งอีเมลได้จริง (SMTP)
ระบบอีเมลฟรีของ Supabase ส่งได้แค่อีเมลของทีมเจ้าของโปรเจกต์ ต้องใช้ Gmail ส่งแทน
1. บัญชี Google ที่จะใช้ส่ง → เปิด **2-Step Verification**
2. ไปที่ myaccount.google.com/apppasswords → สร้าง App Password → ได้รหัส 16 ตัว
3. Supabase → **Authentication → Emails → SMTP Settings** → Enable custom SMTP
   - Sender email: Gmail ของคุณ · Sender name: `DekPro`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: Gmail ของคุณ · Password: App Password 16 ตัว (ไม่มีเว้นวรรค)

### 4. เก็บค่าเชื่อมต่อใน `.env`
Supabase → **Project Settings → API Keys** → คัดลอก **Project URL** และ **Publishable key**

```bash
cp .env.example .env      # แล้วเปิด .env ใส่ค่าจริง
sh scripts/build-config.sh   # สร้าง docs/js/config.js ที่หน้าเว็บอ่าน
```

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxxxxxx
```

- ใส่ค่า**ไม่ต้องมีเครื่องหมายคำพูด** และแก้ `.env` แล้วต้องรัน `sh scripts/build-config.sh` ใหม่
- `.env` และ `docs/js/config.js` อยู่ใน `.gitignore` จึงไม่ถูกอัปขึ้น GitHub
- **ข้อควรรู้:** publishable key ถูกส่งไปถึงเบราว์เซอร์ของผู้ใช้ทุกคนโดยออกแบบ การใช้ `.env` ช่วยให้ไม่ฝังค่าไว้ในโค้ดและเปลี่ยนโปรเจกต์ง่าย แต่ไม่ได้ทำให้ key เป็นความลับ ความปลอดภัยของข้อมูลมาจาก Row Level Security ที่เปิดไว้ในทุกตาราง
- **ห้าม**ใช้ `secret` / `service_role` key (สคริปต์จะปฏิเสธให้) และ App Password ของ Gmail ใส่ใน Supabase เท่านั้น ไม่ใส่ในโค้ดหรือ `.env`

### 5. ทดสอบในเครื่อง
ติดตั้งส่วนขยาย **Live Server** ใน VS Code → คลิกขวาที่ `docs/index.html` → **Open with Live Server**

### 6. Deploy

**Vercel**
1. vercel.com → **Add New → Project** → เลือก repo นี้
2. หน้า Configure ไม่ต้องแก้ Build / Output (ตั้งไว้ใน `vercel.json` แล้ว)
3. **Environment Variables** → เพิ่ม `SUPABASE_URL` และ `SUPABASE_KEY` (ค่าเดียวกับใน `.env`) → **Deploy**
4. ได้ลิงก์ `https://<ชื่อโปรเจกต์>.vercel.app` → นำไปใส่ที่ Supabase → **Authentication → URL Configuration → Site URL**

**GitHub Pages** (ผ่าน GitHub Actions ใน `.github/workflows/pages.yml`)
1. repo → **Settings → Secrets and variables → Actions → Variables** → เพิ่ม `SUPABASE_URL` และ `SUPABASE_KEY`
2. repo → **Settings → Pages** → Source เลือก **GitHub Actions**
3. push ขึ้น `main` ระบบจะ build และ deploy ให้เอง ได้ลิงก์ `https://<username>.github.io/<repo>/`

---

## ข้อมูลมหาวิทยาลัยจริง (TCAS70)

ชุดข้อมูลจริงอยู่ใน [`data/`](data/README.md): สถาบัน 92 แห่ง คณะ 908 หลักสูตร 4,622 รายการ เกณฑ์รอบ 2 และ 3 ปี 2570
สัดส่วนคะแนน TGAT/TPAT/A-Level คะแนนต่ำสุด-สูงสุดปี 2567–2569 และหัวข้อที่ต้องอ่าน 257 หัวข้อ
ดึงจากข้อมูลสาธารณะของ mytcas.com ด้วยสคริปต์ [`scripts/build_tcas_dataset.py`](scripts/build_tcas_dataset.py)
วิธีนำเข้าเข้า Supabase ทีละขั้น และข้อจำกัดของข้อมูล อ่านที่ [`data/README.md`](data/README.md)

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| แถบเหลือง "ยังไม่มีไฟล์ docs/js/config.js" | ยังไม่ได้รัน `sh scripts/build-config.sh` หรือยังไม่มีไฟล์ `.env` |
| `db is not defined` | `docs/js/config.js` ไม่ถูกสร้าง หรือโหลดไม่ขึ้น ให้รัน `sh scripts/build-config.sh` ใหม่ |
| อีเมลลืมรหัสผ่านเป็นลิงก์ ไม่มีรหัส OTP | Supabase → Authentication → Emails → Templates → **Reset Password** ต้องมี `{{ .Token }}` ในเนื้อหา วางไฟล์ `email-reset-password.html` ในแท็บ Source แล้วกด Save |
| กดลิงก์ในอีเมลแล้วขึ้น "This site can't be reached" (127.0.0.1) | ลิงก์ชี้ไป Site URL ที่เป็น localhost ซึ่งเปิดได้เฉพาะบนเครื่องที่รัน Live Server ระบบนี้ใช้ OTP จึงไม่ต้องกดลิงก์ ให้กรอกรหัส 6 หลักในหน้าเว็บแทน ตอน deploy จริงให้ตั้ง Authentication → URL Configuration → Site URL เป็น `https://<username>.github.io/<repo>/` |
| ขอ OTP ซ้ำแล้วขึ้นว่าถี่เกินไป | Supabase จำกัดให้ขอได้ทุก 60 วินาที รอแล้วลองใหม่ |
| ตัวเลือกคณะ/มหาลัยน้อย | รัน `supabase/seed-more.sql` เพิ่ม |
