import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { getUserIdFromRequest } from '@/lib/auth'; // Import hàm giải mã JWT dùng chung

// Hỗ trợ kiểm tra cả thư mục lưu trữ cũ (public/uploads) lẫn mới (storage/uploads)
const PUBLIC_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const SECURE_UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
const TRASH_DIR = path.join(process.cwd(), 'storage', 'trash');

export async function PATCH(request, { params }) {
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

    // 2. Lấy thông tin username và phòng ban chính của user hiện tại
    const userRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT username, primary_dept_code FROM users WHERE id = @userId');
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
    const isCancelRole = userRoles.includes('CANCEL');
    const isTP = userRoles.includes('TP');
    const userDeptCode = currentUser.primary_dept_code;

    // 4. Await params và validate docId thành số nguyên
    const resolvedParams = await params;
    const docId = parseInt(resolvedParams.id, 10);

    if (isNaN(docId)) {
      return NextResponse.json({ error: 'Mã tờ trình không hợp lệ!' }, { status: 400 });
    }

    // 5. Kiểm tra an toàn dữ liệu JSON gửi lên
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ!' }, { status: 400 });
    }

    const { reason } = body || {};

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'Vui lòng nhập lý do hủy số!' }, { status: 400 });
    }

    // Lấy thông tin tờ trình kèm tính toán trạng thái động computed_status
    const checkDoc = await pool
      .request()
      .input('DocId', sql.Int, docId)
      .query(`
        SELECT document_number, dept_code, created_by_user, file_path, status, expiration_date,
          CASE 
            WHEN status = 'CANCELLED' THEN 'CANCELLED'
            WHEN expiration_date IS NOT NULL AND expiration_date < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
            ELSE 'ACTIVE'
          END AS computed_status
        FROM documents 
        WHERE id = @DocId
      `);

    if (checkDoc.recordset.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tờ trình!' }, { status: 404 });
    }

    const doc = checkDoc.recordset[0];

    // CHẶN: Nếu văn bản đã hết hạn thì không được phép hủy
    if (doc.computed_status === 'EXPIRED') {
      return NextResponse.json({ error: 'Văn bản đã hết hạn, không thể thực hiện hủy số!' }, { status: 403 });
    }

    // CHẶN: Nếu văn bản đã hủy trước đó
    if (doc.computed_status === 'CANCELLED') {
      return NextResponse.json({ error: 'Tờ trình này đã được hủy trước đó!' }, { status: 400 });
    }

    // 6. Kiểm tra phân quyền hủy
    const isOwner = doc.created_by_user === currentUser.username;
    const isTPOfDept = isTP && userDeptCode && doc.dept_code?.toUpperCase() === userDeptCode.toUpperCase();
    const canCancel = isVTLTOrAdmin || isCancelRole || isTPOfDept;

    if (!canCancel) {
      return NextResponse.json(
        { error: 'Bạn không có quyền hủy văn bản này!' },
        { status: 403 }
      );
    }

    // 7. Thực hiện Soft Delete file: Kiểm tra tìm file ở cả storage/uploads lẫn public/uploads
    if (doc.file_path) {
      const fileName = path.basename(doc.file_path);
      
      let sourcePath = path.join(SECURE_UPLOAD_DIR, fileName);
      if (!existsSync(sourcePath)) {
        sourcePath = path.join(PUBLIC_UPLOAD_DIR, fileName);
      }

      if (existsSync(sourcePath)) {
        await fs.mkdir(TRASH_DIR, { recursive: true });
        const targetPath = path.join(TRASH_DIR, fileName);
        
        await fs.rename(sourcePath, targetPath).catch((err) => {
          console.warn(`[Cảnh báo] Không thể di chuyển file sang thư mục trash: ${sourcePath}`, err);
        });
      }
    }

    // Sử dụng Transaction để cập nhật trạng thái văn bản và ghi log đồng bộ
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      // 8. Cập nhật trạng thái, lý do hủy và clear file_path vào CSDL
      await new sql.Request(transaction)
        .input('DocId', sql.Int, docId)
        .input('Reason', sql.NVarChar(255), reason.trim())
        .query(`
          UPDATE documents 
          SET status = 'CANCELLED', 
              cancel_reason = @Reason, 
              file_path = NULL,
              updated_at = GETDATE()
          WHERE id = @DocId
        `);

      // 9. Ghi nhận log hủy văn bản kèm thông tin client_ip và user_agent vào bảng document_audit_logs
      const auditDetails = `Hủy số văn bản với lý do (Soft Delete file): "${reason.trim()}"`;
      await new sql.Request(transaction)
        .input('docId', sql.Int, docId)
        .input('docNum', sql.VarChar, doc.document_number)
        .input('actionType', sql.VarChar, 'CANCEL_DOC')
        .input('performedBy', sql.VarChar, currentUser.username)
        .input('clientIP', sql.VarChar, clientIP)
        .input('userAgent', sql.NVarChar, userAgent)
        .input('details', sql.NVarChar, auditDetails)
        .query(`
          INSERT INTO document_audit_logs (document_id, document_number, action_type, performed_by, client_ip, user_agent, action_details)
          VALUES (@docId, @docNum, @actionType, @performedBy, @clientIP, @userAgent, @details)
        `);

      await transaction.commit();

      return NextResponse.json({ message: 'Hủy số tờ trình thành công!' });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error('Lỗi khi hủy số tờ trình:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi thực hiện hủy số: ' + error.message }, { status: 500 });
  }
}