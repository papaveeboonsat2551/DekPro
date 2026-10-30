#!/bin/sh
# สร้าง docs/js/config.js จากตัวแปร SUPABASE_URL และ SUPABASE_KEY
#   - บน Vercel / GitHub Actions : อ่านจาก Environment Variables
#   - ในเครื่อง                   : อ่านจากไฟล์ .env (ตัวแปรที่ตั้งไว้ในระบบมาก่อนไฟล์ .env)
# วิธีใช้ในเครื่อง:  sh scripts/build-config.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$ROOT/.env" ]; then
  while IFS='=' read -r name value; do
    value=$(printf '%s' "$value" | tr -d '\r')
    case "$name" in
      SUPABASE_URL) [ -n "${SUPABASE_URL:-}" ] || SUPABASE_URL="$value" ;;
      SUPABASE_KEY) [ -n "${SUPABASE_KEY:-}" ] || SUPABASE_KEY="$value" ;;
    esac
  done < "$ROOT/.env"
fi

fail() { echo "build-config: $1" >&2; exit 1; }

[ -n "${SUPABASE_URL:-}" ] || fail "ไม่พบ SUPABASE_URL (ตั้งใน .env หรือ Environment Variables)"
[ -n "${SUPABASE_KEY:-}" ] || fail "ไม่พบ SUPABASE_KEY (ตั้งใน .env หรือ Environment Variables)"

case "$SUPABASE_URL" in https://*) ;; *) fail "SUPABASE_URL ต้องขึ้นต้นด้วย https://" ;; esac

# กันใส่ key ผิดชนิด: ค่าในไฟล์นี้จะถูกส่งถึงเบราว์เซอร์ของทุกคน
case "$SUPABASE_KEY" in
  sb_secret_*|*service_role*) fail "ห้ามใช้ secret / service_role key — ใช้ publishable (หรือ anon) key เท่านั้น" ;;
esac

# กันอักขระที่ทำให้ไฟล์ JS พัง
case "$SUPABASE_URL$SUPABASE_KEY" in
  *\"*|*\\*|*" "*|*"'"*) fail "ค่าต้องไม่มีเครื่องหมายคำพูด, backslash หรือช่องว่าง (ใส่ค่าใน .env โดยไม่ต้องมี \"...\")" ;;
esac

OUT="$ROOT/docs/js/config.js"
printf '// สร้างอัตโนมัติโดย scripts/build-config.sh — ห้ามแก้เอง และห้าม commit\nwindow.DEKPRO_CONFIG = {\n  SUPABASE_URL: "%s",\n  SUPABASE_KEY: "%s"\n};\n' \
  "$SUPABASE_URL" "$SUPABASE_KEY" > "$OUT"
echo "build-config: เขียน docs/js/config.js แล้ว"
