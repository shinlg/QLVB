import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import bcrypt from 'bcryptjs';

// 1. GET: Lấy danh sách toàn bộ người dùng kèm theo mảng roles
export async function GET() {
  try {
    const pool = await getDbPool();
    
    // Lấy danh sách user
    const usersResult = await pool.request().query(`
      SELECT 
        id, username, full_name, primary_dept_code, status, 
        failed_login_count, must_change_password, last_login_at, created_at
      FROM users 
      ORDER BY id DESC
    `);

    // Lấy toàn bộ phân quyền từ bảng user_roles
    const rolesResult = await pool.request().query(`
      SELECT user_id, role_code FROM user_roles
    `);

    // Gắn danh sách role vào từng user tương ứng
    const users = usersResult.recordset.map(user => {
      const userRoles = rolesResult.recordset
        .filter(r => r.user_id === user.id)
        .map(r => r.role_code);

      return {
        ...user,
        roles: userRoles.length > 0 ? userRoles : ['USER'] // Mặc định USER nếu chưa có
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi Server: ' + err.message }, { status: 500 });
  }
}

// 2. POST: Xử lý Thêm người dùng mới & Các thao tác Quản trị
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, userId } = body;
    const pool = await getDbPool();

    // --- TRƯỜNG HỢP 1: THÊM NGƯỜI DÙNG MỚI ---
    if (action === 'CREATE') {
      const { username, full_name, primary_dept_code, default_password, roles } = body;

      if (!username || !default_password) {
        return NextResponse.json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!' }, { status: 400 });
      }

      // Kiểm tra username trùng lặp
      const checkUser = await pool.request()
        .input('username', sql.VarChar, username.trim())
        .query('SELECT id FROM users WHERE username = @username');

      if (checkUser.recordset.length > 0) {
        return NextResponse.json({ error: 'Tên đăng nhập này đã tồn tại!' }, { status: 400 });
      }

      // Hash mật khẩu khởi tạo
      const passwordHash = await bcrypt.hash(default_password, 10);

      const insertResult = await pool.request()
        .input('username', sql.VarChar, username.trim())
        .input('password_hash', sql.VarChar, passwordHash)
        .input('full_name', sql.NVarChar, full_name ? full_name.trim() : '')
        .input('primary_dept_code', sql.VarChar, primary_dept_code || 'BGD')
        .query(`
          INSERT INTO users (username, password_hash, full_name, primary_dept_code, is_default_password, must_change_password, status, failed_login_count)
          OUTPUT INSERTED.id
          VALUES (@username, @password_hash, @full_name, @primary_dept_code, 1, 1, 'ACTIVE', 0)
        `);

      const newUserId = insertResult.recordset[0].id;

      // Lưu các role được tích chọn vào bảng user_roles
      const rolesToAssign = Array.isArray(roles) && roles.length > 0 ? roles : ['USER'];
      for (const roleCode of rolesToAssign) {
        await pool.request()
          .input('user_id', sql.Int, newUserId)
          .input('role_code', sql.VarChar, roleCode)
          .query('INSERT INTO user_roles (user_id, role_code) VALUES (@user_id, @role_code)');
      }

      return NextResponse.json({ message: 'Tạo tài khoản người dùng mới thành công!' });
    }

    // --- TRƯỜNG HỢP 2: THỰC HIỆN THAO TÁC QUẢN TRỊ ---
    if (!userId) {
      return NextResponse.json({ error: 'Thiếu thông tin người dùng!' }, { status: 400 });
    }

    switch (action) {
      case 'RESET_PASSWORD': {
        const defaultHash = await bcrypt.hash('123456', 10);
        await pool.request()
          .input('id', sql.Int, userId)
          .input('hash', sql.VarChar, defaultHash)
          .query(`
            UPDATE users 
            SET password_hash = @hash, 
                must_change_password = 1, 
                failed_login_count = 0 
            WHERE id = @id
          `);
        return NextResponse.json({ message: 'Đã reset mật khẩu về 123456!' });
      }

      case 'UNLOCK': {
        await pool.request()
          .input('id', sql.Int, userId)
          .query(`
            UPDATE users 
            SET status = 'ACTIVE', 
                failed_login_count = 0 
            WHERE id = @id
          `);
        return NextResponse.json({ message: 'Đã mở khóa tài khoản thành công!' });
      }

      case 'DISABLE': {
        await pool.request()
          .input('id', sql.Int, userId)
          .query(`UPDATE users SET status = 'DISABLED' WHERE id = @id`);
        return NextResponse.json({ message: 'Đã vô hiệu hóa tài khoản!' });
      }

      case 'ENABLE': {
        await pool.request()
          .input('id', sql.Int, userId)
          .query(`UPDATE users SET status = 'ACTIVE', failed_login_count = 0 WHERE id = @id`);
        return NextResponse.json({ message: 'Đã kích hoạt lại tài khoản!' });
      }

      case 'TOGGLE_FORCE_CHANGE_PASS': {
        await pool.request()
          .input('id', sql.Int, userId)
          .query(`
            UPDATE users 
            SET must_change_password = CASE WHEN must_change_password = 1 THEN 0 ELSE 1 END 
            WHERE id = @id
          `);
        return NextResponse.json({ message: 'Đã cập nhật trạng thái yêu cầu đổi mật khẩu!' });
      }

      case 'UPDATE_ROLES':
      case 'UPDATE_USER': {
        const { roles, primary_dept_code } = body;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          // 1. Cập nhật phòng ban chính nếu có truyền lên
          if (primary_dept_code !== undefined) {
            await new sql.Request(transaction)
              .input('id', sql.Int, userId)
              .input('deptCode', sql.VarChar, primary_dept_code)
              .query('UPDATE users SET primary_dept_code = @deptCode WHERE id = @id');
          }

          // 2. Cập nhật lại danh sách roles nếu có truyền lên mảng roles
          if (Array.isArray(roles)) {
            await new sql.Request(transaction)
              .input('id', sql.Int, userId)
              .query('DELETE FROM user_roles WHERE user_id = @id');

            for (const roleCode of roles) {
              await new sql.Request(transaction)
                .input('user_id', sql.Int, userId)
                .input('role_code', sql.VarChar, roleCode)
                .query('INSERT INTO user_roles (user_id, role_code) VALUES (@user_id, @role_code)');
            }
          }

          await transaction.commit();
          return NextResponse.json({ message: 'Cập nhật thông tin người dùng thành công!' });
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }

      default:
        return NextResponse.json({ error: 'Thao tác không hợp lệ!' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi Server: ' + err.message }, { status: 500 });
  }
}