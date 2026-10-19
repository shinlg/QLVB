import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getDbPool();
    const result = await pool
      .request()
      .query('SELECT code, name FROM documents_types ORDER BY id ASC');

    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('Lỗi GET /api/document-types:', error);
    return NextResponse.json(
      { error: 'Lỗi khi lấy danh sách loại văn bản' },
      { status: 500 }
    );
  }
}