import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'SuperSecretKeyForQLVB2026SecureAuthentication!@#'
);

export async function PATCH(request, { params }) {
  const { id } = params;

  try {
    // 1. Xác thực người dùng và giải mã Signed JWT từ cookie auth_token
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Chưa xác thực phiên đăng nhập!' },
        { status: 401 }
      );
    }

    let userId = null;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      userId = payload.userId; // Trả về ID chuẩn dạng số (ví dụ: 1)
    } catch (jwtErr) {
      return NextResponse.json(
        { error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn!' },
        { status: 401 }
      );
    }

    // Lấy thông tin Client IP & User Agent để phục vụ Audit Log
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Device';

    const pool = await getDbPool();

    // 2. Lấy thông tin username và phòng ban chính của user hiện tại đang thao tác
    const userRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT username, primary_dept_code FROM users WHERE id = @userId');
    const currentUser = userRes.recordset[0];

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Người dùng không tồn tại!' },
        { status: 401 }
      );
    }

    // 3. Lấy danh sách roles của user từ bảng trung gian user_roles
    const rolesRes = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT role_code FROM user_roles WHERE user_id = @userId');
    const userRoles = rolesRes.recordset.map((r) => r.role_code);

    const isVTLTOrAdmin = userRoles.includes('VTLT') || userRoles.includes('ADMIN');
    const isVTBP = userRoles.includes('VTBP');
    const isBGDOrAdmin = userRoles.includes('ADMIN') || userRoles.includes('BGD');
    const isTP = userRoles.includes('TP');

    // 4. Lấy thông tin tờ trình cần sửa trong database (Kèm tính toán trạng thái động computed_status)
    const docRes = await pool
      .request()
      .input('docId', sql.Int, id)
      .query(`
        SELECT *,
          CASE 
            WHEN status = 'CANCELLED' THEN 'CANCELLED'
            WHEN expiration_date IS NOT NULL AND expiration_date < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
            ELSE 'ACTIVE'
          END AS computed_status
        FROM documents 
        WHERE id = @docId
      `);
    const documentItem = docRes.recordset[0];

    if (!documentItem) {
      return NextResponse.json(
        { error: 'Không tìm thấy tờ trình để cập nhật!' },
        { status: 404 }
      );
    }

    // 5. CHẶN: Kiểm tra nếu văn bản đã hết hạn hoặc đã hủy thì không được phép chỉnh sửa (Read-only)
    if (documentItem.computed_status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Văn bản đã hết hạn, không được phép chỉnh sửa!' },
        { status: 403 }
      );
    }

    if (documentItem.computed_status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Văn bản đã bị hủy, không được phép chỉnh sửa!' },
        { status: 403 }
      );
    }

    // 6. Kiểm tra phân quyền bảo mật (is_confidential = 1)
    const isOwner = documentItem.created_by_user === currentUser.username;
    const isTPOfDept = isTP && documentItem.dept_code === currentUser.primary_dept_code;

    if (documentItem.is_confidential === 1) {
      const canAccessConfidential = isOwner || isBGDOrAdmin || isTPOfDept;
      if (!canAccessConfidential) {
        return NextResponse.json(
          { error: 'Bạn không có quyền truy cập hoặc chỉnh sửa văn bản bảo mật này!' },
          { status: 403 }
        );
      }
    }

    // 7. Kiểm tra điều kiện phân quyền sửa chung:
    const canEdit = isVTLTOrAdmin || (isVTBP && isOwner) || isTPOfDept || isBGDOrAdmin;

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Bạn không có quyền chỉnh sửa tờ trình này!' },
        { status: 403 }
      );
    }

    // 8. Xử lý dữ liệu cập nhật từ request body
    const body = await request.json();
    const { subject, created_by } = body;

    if (!subject || !subject.trim()) {
      return NextResponse.json(
        { error: 'Trích yếu nội dung không được để trống!' },
        { status: 400 }
      );
    }

    // Sử dụng Transaction để đảm bảo cập nhật văn bản và ghi log đồng bộ
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      // 9. Thực hiện cập nhật thông tin tờ trình
      const updateResult = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('subject', sql.NVarChar, subject.trim())
        .input('createdBy', sql.NVarChar, created_by ? created_by.trim() : null)
        .input('updatedByUser', sql.VarChar, currentUser.username)
        .query(`
          UPDATE documents
          SET subject = @subject,
              created_by = @createdBy,
              updated_by_user = @updatedByUser,
              updated_at = GETDATE()
          WHERE id = @id
        `);

      if (updateResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return NextResponse.json(
          { error: 'Không tìm thấy tờ trình để cập nhật!' },
          { status: 404 }
        );
      }

      // 10. Ghi nhận log thay đổi kèm thông tin IP và User Agent vào bảng document_audit_logs
      const auditDetails = `Cập nhật trích yếu: "${subject.trim()}" | Người yêu cầu: "${created_by || '—'}"`;
      await new sql.Request(transaction)
        .input('docId', sql.Int, id)
        .input('docNum', sql.VarChar, documentItem.document_number)
        .input('actionType', sql.VarChar, 'UPDATE_INFO')
        .input('performedBy', sql.VarChar, currentUser.username)
        .input('clientIP', sql.VarChar, clientIP)
        .input('userAgent', sql.NVarChar, userAgent)
        .input('details', sql.NVarChar, auditDetails)
        .query(`
          INSERT INTO document_audit_logs (document_id, document_number, action_type, performed_by, client_ip, user_agent, action_details)
          VALUES (@docId, @docNum, @actionType, @performedBy, @clientIP, @userAgent, @details)
        `);

      await transaction.commit();

      return NextResponse.json(
        { message: 'Cập nhật thông tin tờ trình thành công!' },
        { status: 200 }
      );
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật tờ trình:', error);
    return NextResponse.json(
      { error: 'Lỗi Server: ' + error.message },
      { status: 500 }
    );
  }
}