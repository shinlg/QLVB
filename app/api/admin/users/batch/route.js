import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const { users } = await req.json(); // Array [{ username, fullName, primaryDeptCode }]
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ!' }, { status: 400 });
    }

    const pool = await getDbPool();
    const defaultHash = await bcrypt.hash('123', 10);
    
    let insertedCount = 0;
    const errors = [];

    for (const item of users) {
      try {
        const { username, fullName, primaryDeptCode } = item;
        if (!username || !fullName) continue;

        // Kiểm tra tồn tại
        const check = await pool.request()
          .input('username', username)
          .query('SELECT id FROM users WHERE username = @username');

        if (check.recordset.length > 0) {
          errors.push(`User [${username}] đã tồn tại`);
          continue;
        }

        // Insert user
        await pool.request()
          .input('username', username)
          .input('fullName', fullName)
          .input('deptCode', primaryDeptCode || 'NSDVHC')
          .input('hash', defaultHash)
          .query(`
            INSERT INTO users (username, full_name, primary_dept_code, password_hash, must_change_password)
            VALUES (@username, @fullName, @deptCode, @hash, 1)
          `);

        insertedCount++;
      } catch (e) {
        errors.push(`Lỗi dòng [${item.username}]: ${e.message}`);
      }
    }

    return NextResponse.json({ success: true, insertedCount, errors });
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi Server: ' + err.message }, { status: 500 });
  }
}