import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { getUserIdFromRequest } from '@/lib/auth'; // Import hàm giải mã JWT dùng chung

const SECURE_UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
const PUBLIC_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];

// Hàm kiểm tra Magic Bytes (MIME Type thực tế) chống giả mạo đuôi file
async function validateFileMagicBytes(buffer, declaredExt) {
  if (buffer.length < 4) return false;
  const header = buffer.subarray(0, 4);

  if (declaredExt === '.pdf') {
    return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
  } else if (declaredExt === '.jpg' || declaredExt === '.jpeg') {
    return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  } else if (declaredExt === '.png') {
    return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  } else if (declaredExt === '.doc' || declaredExt === '.docx') {
    return header[0] === 0x50 && header[1] === 0x4B;
  }
  return true;
}

export async function POST(request, { params }) {
  let savedFilePath = null;

  try {
    // 1. Giải mã lấy userId chuẩn dạng số nguyên từ Signed JWT token
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập!' }, { status: 401 });
    }

    // Thu thập Client IP & User Agent phục vụ Audit Trail
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Device';

    const pool = await getDbPool();

    // 2. Lấy thông tin username của user hiện tại
    const userRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT username FROM users WHERE id = @userId');
    const currentUser = userRes.recordset[0];

    if (!currentUser) {
      return NextResponse.json({ error: 'Người dùng không tồn tại!' }, { status: 401 });
    }

    // 3. Lấy danh sách roles của user từ bảng trung gian user_roles
    const rolesRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT role_code FROM user_roles WHERE user_id = @userId');
    const userRoles = rolesRes.recordset.map((r) => r.role_code);

    const isVTLTOrAdmin = userRoles.includes('VTLT') || userRoles.includes('ADMIN');
    const isVTBP = userRoles.includes('VTBP');

    // 4. Await params và validate docId thành số nguyên
    const resolvedParams = await params;
    const docId = parseInt(resolvedParams.id, 10);

    if (isNaN(docId)) {
      return NextResponse.json({ error: 'Mã tờ trình không hợp lệ!' }, { status: 400 });
    }

    const checkDoc = await pool.request()
      .input('DocId', sql.Int, docId)
      .query(`SELECT document_number, created_by_user, file_path, status FROM documents WHERE id = @DocId`);

    if (checkDoc.recordset.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tờ trình!' }, { status: 404 });
    }

    const doc = checkDoc.recordset[0];
    if (doc.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Văn bản đã bị hủy, không thể upload file!' }, { status: 400 });
    }

    // 5. Kiểm tra phân quyền: VTLT/Admin HOẶC chính chủ (VTBP và là người tạo)
    const isOwner = doc.created_by_user === currentUser.username;
    const canEdit = isVTLTOrAdmin || (isVTBP && isOwner);

    if (!canEdit) {
      return NextResponse.json({ error: 'Bạn không có quyền upload file cho văn bản này!' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('scanFile');

    if (!file || typeof file !== 'object' || file.size === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn file để upload!' }, { status: 400 });
    }

    // Kiểm tra giới hạn dung lượng file tối đa (Ví dụ: 30MB)
    const MAX_FILE_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Dung lượng file vượt quá giới hạn cho phép (Tối đa 30MB)!' }, { status: 400 });
    }

    // 6. Validation đuôi file an toàn
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Định dạng file không hỗ trợ! Chỉ chấp nhận: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Kiểm tra Magic Bytes thực tế chống giả mạo định dạng
    const isValidContent = await validateFileMagicBytes(buffer, ext);
    if (!isValidContent) {
      return NextResponse.json({ error: 'Nội dung file không khớp với định dạng phần mở rộng!' }, { status: 400 });
    }

    // 7. Đảm bảo thư mục lưu trữ bảo mật tồn tại
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // 8. Lưu file mới
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `Scan_${uniqueSuffix}${ext}`;
    savedFilePath = path.join(UPLOAD_DIR, fileName);

    await fs.writeFile(savedFilePath, buffer);

    // 9. Xóa file cũ nếu có trong thư mục an toàn
    const oldFilePath = doc.file_path;
    if (oldFilePath) {
      const fullOldPath = path.join(SECURE_UPLOAD_DIR, path.basename(oldFilePath));
      if (existsSync(fullOldPath)) {
        await fs.unlink(fullOldPath).catch(() => {});
      }
    }

    // Sử dụng Transaction để cập nhật CSDL và ghi log đồng bộ
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      // 10. Cập nhật tên file vào CSDL
      await new sql.Request(transaction)
        .input('DocId', sql.Int, docId)
        .input('FilePath', sql.NVarChar(255), fileName)
        .input('UpdatedByUser', sql.VarChar(50), currentUser.username)
        .query(`
          UPDATE documents 
          SET file_path = @FilePath, 
              updated_by_user = @UpdatedByUser,
              updated_at = GETDATE()
          WHERE id = @DocId
        `);

      // 11. Ghi nhận log upload kèm thông tin client_ip và user_agent vào bảng document_audit_logs
      const auditDetails = `Upload bổ sung file đính kèm an toàn: ${fileName}`;
      await new sql.Request(transaction)
        .input('docId', sql.Int, docId)
        .input('docNum', sql.VarChar, doc.document_number)
        .input('actionType', sql.VarChar, 'UPLOAD_FILE')
        .input('performedBy', sql.VarChar, currentUser.username)
        .input('clientIP', sql.VarChar, clientIP)
        .input('userAgent', sql.NVarChar, userAgent)
        .input('details', sql.NVarChar, auditDetails)
        .query(`
          INSERT INTO document_audit_logs (document_id, document_number, action_type, performed_by, client_ip, user_agent, action_details)
          VALUES (@docId, @docNum, @actionType, @performedBy, @clientIP, @userAgent, @details)
        `);

      await transaction.commit();

      return NextResponse.json({ message: 'Upload bổ sung file thành công!', filePath: fileName });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

  } catch (error) {
    console.error('Lỗi khi upload bổ sung file:', error);
    if (savedFilePath && existsSync(savedFilePath)) {
      await fs.unlink(savedFilePath).catch(() => {});
    }
    return NextResponse.json({ error: 'Lỗi hệ thống khi lưu file bổ sung: ' + error.message }, { status: 500 });
  }
}