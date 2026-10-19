// app/api/roles/route.js
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT role_code, role_name, description, role_level 
      FROM roles 
      ORDER BY role_level ASC
    `);
    return NextResponse.json(result.recordset);
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi tải danh sách roles: ' + err.message }, { status: 500 });
  }
}