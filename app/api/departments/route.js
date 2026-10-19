import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT 
        id,
        code, 
        name 
      FROM departments 
      ORDER BY name ASC
    `);

    return NextResponse.json(result.recordset);
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi tải phòng ban: ' + err.message }, { status: 500 });
  }
}