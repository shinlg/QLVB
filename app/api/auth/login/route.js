import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

// Khởi tạo Secret Key dùng để ký token (nên cấu hình trong file .env.production)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'SuperSecretKeyForQLVB2026SecureAuthentication!@#'
);

async function signToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h') // Token hết hạn sau 8 giờ làm việc
    .sign(JWT_SECRET);
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin!' }, { status: 400 });
    }

    const pool = await getDbPool();

    // 1. Tìm user trong CSDL
    let userRes = await pool.request()
      .input('username', sql.VarChar, username.trim())
      .query('SELECT * FROM users WHERE username = @username');

    let user = userRes.recordset[0];

    // 2. Tự động khởi tạo tài khoản admin nếu chưa có
    if (!user && username.trim() === 'admin') {
      const defaultHash = await bcrypt.hash('123456', 10);
      
      const insertUserRes = await pool.request()
        .input('username', sql.VarChar, 'admin')
        .input('password_hash', sql.VarChar, defaultHash)
        .input('full_name', sql.NVarChar, 'Quản trị hệ thống')
        .input('primary_dept_code', sql.VarChar, 'NSDVHC')
        .query(`
          INSERT INTO users (username, password_hash, full_name, primary_dept_code, is_default_password, must_change_password, status)
          OUTPUT INSERTED.id
          VALUES (@username, @password_hash, @full_name, @primary_dept_code, 1, 1, 'ACTIVE')
        `);

      const newAdminId = insertUserRes.recordset[0].id;

      // Gán role ADMIN vào bảng trung gian user_roles cho tài khoản khởi tạo
      await pool.request()
        .input('user_id', sql.Int, newAdminId)
        .input('role_code', sql.VarChar, 'ADMIN')
        .query('INSERT INTO user_roles (user_id, role_code) VALUES (@user_id, @role_code)');

      userRes = await pool.request()
        .input('username', sql.VarChar, 'admin')
        .query('SELECT * FROM users WHERE username = @username');
      user = userRes.recordset[0];
    }

    // 3. Kiểm tra trạng thái tài khoản
    if (!user || user.status === 'DISABLED_RESIGNED' || user.status === 'DISABLED') {
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' }, { status: 401 });
    }

    // Kiểm tra nếu tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần
    if (user.status === 'LOCKED_FAILED_ATTEMPTS' || (user.failed_login_count >= 5)) {
      if (user.status !== 'LOCKED_FAILED_ATTEMPTS') {
        await pool.request()
          .input('id', sql.Int, user.id)
          .query("UPDATE users SET status = 'LOCKED_FAILED_ATTEMPTS' WHERE id = @id");
      }
      return NextResponse.json({ error: 'Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng liên hệ quản trị viên để mở khóa.' }, { status: 403 });
    }

    // 4. So sánh mật khẩu
    let isMatch = false;

    if (user.password_hash) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!isMatch && password === '123456' && (user.must_change_password === 1 || user.must_change_password === true)) {
      isMatch = true;
    }

    if (!isMatch) {
      // Tăng số lần đăng nhập sai và tự động khóa nếu đạt mốc >= 5
      const updateRes = await pool.request()
        .input('id', sql.Int, user.id)
        .query(`
          UPDATE users 
          SET failed_login_count = ISNULL(failed_login_count, 0) + 1,
              status = CASE WHEN ISNULL(failed_login_count, 0) + 1 >= 5 THEN 'LOCKED_FAILED_ATTEMPTS' ELSE status END
          OUTPUT INSERTED.failed_login_count, INSERTED.status
          WHERE id = @id
        `);

      const currentFailedCount = updateRes.recordset[0].failed_login_count;
      const currentStatus = updateRes.recordset[0].status;
      const remainingAttempts = Math.max(0, 5 - currentFailedCount);

      if (currentStatus === 'LOCKED_FAILED_ATTEMPTS' || currentFailedCount >= 5) {
        return NextResponse.json({ error: 'Bạn đã nhập sai mật khẩu quá 5 lần. Tài khoản đã bị khóa!' }, { status: 403 });
      }

      return NextResponse.json({ error: `Tên đăng nhập hoặc mật khẩu không chính xác. Bạn còn ${remainingAttempts} lần thử.` }, { status: 401 });
    }

    // 5. Đăng nhập thành công -> Reset đếm sai, chuyển trạng thái ACTIVE & Cập nhật thời gian đăng nhập
    await pool.request()
      .input('id', sql.Int, user.id)
      .query("UPDATE users SET failed_login_count = 0, status = 'ACTIVE', last_login_at = GETDATE() WHERE id = @id");

    // Truy vấn lấy danh sách tất cả các role từ bảng user_roles của user này
    const rolesResult = await pool.request()
      .input('userId', sql.Int, user.id)
      .query('SELECT role_code FROM user_roles WHERE user_id = @userId');

    const userRolesArray = rolesResult.recordset.map(r => r.role_code);
    const finalRoles = userRolesArray.length > 0 ? userRolesArray : ['USER'];

    const isMustChange = user.must_change_password === true || user.must_change_password === 1 || user.must_change_password === '1';

    // Tạo JWT Token chứa thông tin định danh và quyền hạn được ký điện tử an toàn
    const token = await signToken({
      userId: user.id,
      username: user.username,
      roles: finalRoles
    });

    // Tạo response trả về JSON
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        deptCode: user.primary_dept_code,
        roles: finalRoles,
        mustChangePassword: isMustChange,
      }
    });

    // 6. Ghi Cookie Signed JWT (Bảo vệ HttpOnly, chống XSS và giả mạo)
    res.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 giờ
    });

    return res;

  } catch (err) {
    return NextResponse.json({ error: 'Lỗi Server: ' + err.message }, { status: 500 });
  }
}