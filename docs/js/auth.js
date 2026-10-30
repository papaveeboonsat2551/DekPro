// =====================================================================
// หน้า Login / สร้างบัญชี / ลืมรหัสผ่าน
// ทั้ง 3 หน้าใช้ไฟล์นี้ร่วมกัน (ทำงานเฉพาะฟอร์มที่มีอยู่ในหน้านั้น)
// =====================================================================

redirectIfLoggedIn();

// ---------- เข้าสู่ระบบ ----------
const loginForm = $("#login-form");
if (loginForm) {
  if (new URLSearchParams(location.search).has("reset")) {
    toast("เปลี่ยนรหัสผ่านแล้ว เข้าสู่ระบบด้วยรหัสใหม่ได้เลย", "success");
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { email, password } = loginForm.elements;
    withBusy($("button[type=submit]", loginForm), async () => {
      const { error } = await db.auth.signInWithPassword({
        email: email.value.trim().toLowerCase(),
        password: password.value,
      });
      if (error) throw error;
      location.href = "profile.html";
    });
  });
}

// ---------- สร้างบัญชีใหม่ ----------
const registerForm = $("#register-form");
if (registerForm) {
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { email, password, confirm } = registerForm.elements;
    if (password.value !== confirm.value) {
      toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน", "error");
      return;
    }
    withBusy($("button[type=submit]", registerForm), async () => {
      // Supabase เข้ารหัสรหัสผ่านให้ และไม่ยอมให้อีเมลซ้ำ (1 อีเมล = 1 บัญชี)
      const { data, error } = await db.auth.signUp({
        email: email.value.trim().toLowerCase(),
        password: password.value,
      });
      if (error) throw error;
      // ถ้า Supabase ยังเปิด "Confirm email" จะไม่ error ตอนอีเมลซ้ำ แต่ส่ง user ที่ไม่มี identities กลับมา
      if (data.user?.identities?.length === 0) throw new Error("User already registered");
      if (!data.session) {
        toast("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ", "info");
        return;
      }
      location.href = "profile.html?edit=1";
    });
  });
}

// ---------- ลืมรหัสผ่าน (OTP ทางอีเมล) ----------
const resetRoot = $("#reset-root");
if (resetRoot) {
  mountPasswordReset(resetRoot, {
    onDone: async () => {
      // ยืนยัน OTP แล้วระบบจะล็อกอินให้อัตโนมัติ → ออกจากระบบ แล้วให้ล็อกอินใหม่ด้วยรหัสใหม่
      await db.auth.signOut();
      location.replace("index.html?reset=1");
    },
  });
}
