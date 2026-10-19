import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getUserIdFromRequest } from '@/lib/auth'; // Import hàm giải mã JWT dùng chung

export async function POST(req) {
  try {
    // 1. Giải mã lấy userId chuẩn dạng số nguyên từ Signed JWT token
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập!' }, { status: 401 });
    }

    const body = await req.json();
    const { oldPassword, newPassword } = body || {};

    if (!newPassword) {
      return NextResponse.json({ error: 'Vui lòng nhập mật khẩu mới!' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên!' }, { status: 400 });
    }

    const pool = await getDbPool();

    // 2. Lấy thông tin user hiện tại kèm cờ must_change_password từ CSDL
    const userRes = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT username, password_hash, must_change_password FROM users WHERE id = @userId');

    const currentUser = userRes.recordset[0];
    if (!currentUser) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại!' }, { status: 404 });
    }

    // 3. Kiểm tra điều kiện mật khẩu cũ:
    // Nếu tài khoản không ở trạng thái bắt buộc đổi mật khẩu lần đầu thì bắt buộc phải có oldPassword và khớp
    const mustChange = currentUser.must_change_password === 1 || currentUser.must_change_password === true;

    if (!mustChange) {
      if (!oldPassword) {
        return NextResponse.json({ error: 'Vui lòng nhập mật khẩu cũ!' }, { status: 400 });
      }
      const isPasswordValid = await bcrypt.compare(oldPassword, currentUser.password_hash);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Mật khẩu cũ không chính xác!' }, { status: 400 });
      }
    }

    // 4. Hash mật khẩu mới
    const newHash = await bcrypt.hash(newPassword, 10);

    // 5. Cập nhật mật khẩu mới và đặt must_change_password = 0
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('passwordHash', sql.VarChar(255), newHash)
      .query(`
        UPDATE users 
        SET password_hash = @passwordHash, 
            must_change_password = 0 
        WHERE id = @userId
      `);

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('Lỗi khi đổi mật khẩu:', err);
    return NextResponse.json({ error: 'Lỗi Server: ' + err.message }, { status: 500 });
  }
}