import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { getUserIdFromRequest } from '@/lib/auth'; // Import hàm giải mã JWT dùng chung

const SECURE_UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
const PUBLIC_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET(request, { params }) {
  try {
    // 1. Giải mã lấy userId chuẩn dạng số nguyên từ Signed JWT token
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập!' }, { status: 401 });
    }

    const pool = await getDbPool();

    // 2. Lấy thông tin user hiện tại (role & phòng ban) để phân quyền bảo mật
    const userRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT username, primary_dept_code FROM users WHERE id = @userId');
    const currentUser = userRes.recordset[0];

    if (!currentUser) {
      return NextResponse.json({ error: 'Người dùng không tồn tại!' }, { status: 401 });
    }

    const rolesRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT role_code FROM user_roles WHERE user_id = @userId');
    const userRoles = rolesRes.recordset.map((r) => r.role_code);

    // Bổ sung ma trận quyền BGD (Ban Giám Đốc) vào nhóm đặc quyền
    const isPrivileged = userRoles.includes('VTLT') || userRoles.includes('ADMIN') || userRoles.includes('BGD');
    const isTP = userRoles.includes('TP');
    const userDeptCode = currentUser.primary_dept_code;

    const resolvedParams = await params;
    const docId = parseInt(resolvedParams.id, 10);

    if (isNaN(docId)) {
      return NextResponse.json({ error: 'Mã tờ trình không hợp lệ!' }, { status: 400 });
    }

    // 3. Truy vấn đầy đủ thông tin tờ trình gồm cờ bảo mật, phòng ban và người tạo
    const docRes = await pool.request()
      .input('DocId', sql.Int, docId)
      .query('SELECT file_path, status, dept_code, created_by_user, is_confidential FROM documents WHERE id = @DocId');

    if (docRes.recordset.length === 0 || !docRes.recordset[0].file_path) {
      return NextResponse.json({ error: 'Không tìm thấy file đính kèm!' }, { status: 404 });
    }

    const doc = docRes.recordset[0];
    if (doc.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Văn bản đã bị hủy, không thể tải file!' }, { status: 403 });
    }

    // 4. Kiểm tra phân quyền truy cập tài liệu bảo mật
    const isOwner = doc.created_by_user === currentUser.username;
    const isTPOfDept = isTP && userDeptCode && doc.dept_code?.toUpperCase() === userDeptCode.toUpperCase();
    const isConfidential = doc.is_confidential === 1 || doc.is_confidential === true;

    if (isConfidential && !isPrivileged && !isOwner && !isTPOfDept) {
      return NextResponse.json({ error: 'Bạn không có quyền truy cập tài liệu bảo mật này!' }, { status: 403 });
    }

    // 5. Tìm kiếm file theo cơ chế Fallback (Kiểm tra storage/uploads trước, nếu không thấy quét tiếp public/uploads)
    const fileName = path.basename(doc.file_path);
    let filePath = path.join(SECURE_UPLOAD_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_UPLOAD_DIR, fileName);
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Tệp không tồn tại trên hệ thống lưu trữ!' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const stat = fs.statSync(filePath);

    // Xác định chuẩn Content-Type linh hoạt
    let contentType = 'application/pdf';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (filePath.endsWith('.png')) contentType = 'image/png';
    else if (filePath.endsWith('.doc') || filePath.endsWith('.docx')) contentType = 'application/msword';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Lỗi tải file bảo mật:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi tải file!' }, { status: 500 });
  }
}