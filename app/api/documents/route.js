import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { jwtVerify } from 'jose';

// Khởi tạo Secret Key dùng để giải mã Signed JWT
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'SuperSecretKeyForQLVB2026SecureAuthentication!@#'
);

// Hàm phụ trợ giải mã JWT để lấy userId chuẩn dạng số nguyên
async function getUserIdFromRequest(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.userId || null;
  } catch (err) {
    return null;
  }
}

// Chuyển đường dẫn lưu trữ sang thư mục bảo mật storage/uploads
const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
const MAX_FILE_SIZE = 30 * 1024 * 1024; // Giới hạn 30MB

// Hàm kiểm tra Magic Bytes chống giả mạo định dạng file
async function validateFileMagicBytes(buffer, ext) {
  if (buffer.length < 4) return false;
  
  const header = buffer.subarray(0, 4);
  
  if (ext === '.pdf') {
    return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
  }
  if (ext === '.png') {
    return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  }
  if (ext === '.docx' || ext === '.doc') {
    return header[0] === 0x50 && header[1] === 0x4B;
  }
  return true; 
}

function formatSequenceNumber(num) {
  return num.toString().padStart(2, '0');
}

// 1. TÌM KIẾM & PHÂN TRANG VĂN BẢN (CÓ LỌC BẢO MẬT & TRẠNG THÁI ĐỘNG)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const deptCode = searchParams.get('deptCode');
  const docTypeCode = searchParams.get('docTypeCode');
  const createdBy = searchParams.get('createdBy');
  const statusFilter = searchParams.get('status');

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));
  const offset = (page - 1) * limit;

  try {
    const pool = await getDbPool();

    // Giải mã userId từ Signed JWT token
    const userId = await getUserIdFromRequest(request);
    let currentUsername = '';
    let userDeptCode = '';
    let userRoles = [];

    if (userId) {
      const userRes = await pool.request()
        .input('AuthUserId', sql.Int, userId)
        .query('SELECT username, primary_dept_code FROM users WHERE id = @AuthUserId');
      
      if (userRes.recordset.length > 0) {
        currentUsername = userRes.recordset[0].username;
        userDeptCode = userRes.recordset[0].primary_dept_code || '';
      }

      const rolesRes = await pool.request()
        .input('AuthUserIdRole', sql.Int, userId)
        .query('SELECT role_code FROM user_roles WHERE user_id = @AuthUserIdRole');
      
      userRoles = rolesRes.recordset.map(r => r.role_code);
    }

    const isBGDOrAdmin = userRoles.includes('ADMIN') || userRoles.includes('BGD');
    const isTP = userRoles.includes('TP');

    const dbRequest = pool.request();
    const whereClauses = [];

    dbRequest.input('CurrentUsername', sql.VarChar(50), currentUsername);
    dbRequest.input('IsBGDOrAdmin', sql.Bit, isBGDOrAdmin ? 1 : 0);
    dbRequest.input('IsTP', sql.Bit, isTP ? 1 : 0);
    dbRequest.input('UserDeptCode', sql.VarChar(20), userDeptCode);

    whereClauses.push(`(
      is_confidential = 0 
      OR is_confidential IS NULL
      OR created_by_user = @CurrentUsername
      OR @IsBGDOrAdmin = 1
      OR (@IsTP = 1 AND dept_code = @UserDeptCode)
    )`);

    if (q && q.trim() !== '') {
      dbRequest.input('SearchKey', sql.NVarChar, `%${q.trim()}%`);
      whereClauses.push(
        `(document_number LIKE @SearchKey OR subject LIKE @SearchKey OR created_by LIKE @SearchKey OR created_by_user LIKE @SearchKey)`
      );
    }

    if (deptCode && deptCode.trim() !== '') {
      dbRequest.input('DeptParam', sql.VarChar(20), deptCode.trim().toUpperCase());
      whereClauses.push(`dept_code = @DeptParam`);
    }

    if (docTypeCode && docTypeCode.trim() !== '') {
      dbRequest.input('DocTypeParam', sql.VarChar(20), docTypeCode.trim().toUpperCase());
      whereClauses.push(`doc_type = @DocTypeParam`);
    }

    if (createdBy && createdBy.trim() !== '') {
      dbRequest.input('CreatedByParam', sql.NVarChar(50), `%${createdBy.trim()}%`);
      whereClauses.push(`created_by LIKE @CreatedByParam`);
    }

    if (statusFilter && statusFilter.trim() !== '') {
      const cleanStatus = statusFilter.trim().toUpperCase();
      if (cleanStatus === 'CANCELLED') {
        whereClauses.push(`status = 'CANCELLED'`);
      } else if (cleanStatus === 'EXPIRED') {
        whereClauses.push(`status != 'CANCELLED' AND expiration_date IS NOT NULL AND expiration_date < CAST(GETDATE() AS DATE)`);
      } else if (cleanStatus === 'ACTIVE') {
        whereClauses.push(`status != 'CANCELLED' AND (expiration_date IS NULL OR expiration_date >= CAST(GETDATE() AS DATE))`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await dbRequest.query(`
      SELECT COUNT(*) AS total 
      FROM documents 
      ${whereSql}
    `);
    const total = countResult.recordset[0].total;
    const totalPages = Math.ceil(total / limit) || 1;

    dbRequest.input('OffsetParam', sql.Int, offset);
    dbRequest.input('LimitParam', sql.Int, limit);

    const dataResult = await dbRequest.query(`
      SELECT *,
        CASE 
          WHEN status = 'CANCELLED' THEN 'CANCELLED'
          WHEN expiration_date IS NOT NULL AND expiration_date < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END AS computed_status
      FROM documents 
      ${whereSql}
      ORDER BY id DESC
      OFFSET @OffsetParam ROWS
      FETCH NEXT @LimitParam ROWS ONLY
    `);

    return NextResponse.json({
      data: dataResult.recordset,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Lỗi khi tìm kiếm văn bản:', error);
    return NextResponse.json({ error: 'Không thể lấy danh sách văn bản!' }, { status: 500 });
  }
}

// 2. CẤP SỐ VĂN BẢN MỚI
export async function POST(request) {
  let savedFilePath = null;

  try {
    // Giải mã userId chuẩn từ Signed JWT token
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập!' }, { status: 401 });
    }

    const pool = await getDbPool();

    const userRes = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT id, username, primary_dept_code FROM users WHERE id = @userId');

    const user = userRes.recordset[0];
    if (!user) {
      return NextResponse.json({ error: 'Người dùng không tồn tại trong hệ thống!' }, { status: 401 });
    }

    const currentUsername = user.username;

    const rolesRes = await pool.request()
      .input('userId', sql.Int, user.id)
      .query('SELECT role_code FROM user_roles WHERE user_id = @userId');

    const userRoles = rolesRes.recordset.map(r => r.role_code);
    const isVTLTOrAdmin = userRoles.includes('VTLT') || userRoles.includes('ADMIN');
    const userDeptCode = user.primary_dept_code;

    const formData = await request.formData();
    const docType = formData.get('docType');
    const deptCode = formData.get('deptCode');
    const subject = formData.get('subject');
    const createdBy = formData.get('createdBy');
    const effectiveDate = formData.get('effectiveDate');
    const expirationDate = formData.get('expirationDate');
    const file = formData.get('scanFile');
    
    const rawConfidential = formData.get('isConfidential');
    const isConfidential = rawConfidential === 'true' || rawConfidential === 'on' || rawConfidential === '1' ? 1 : 0;

    if (!docType || !deptCode || !subject) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc!' }, { status: 400 });
    }

    const cleanDeptCode = deptCode.toUpperCase();
    const cleanDocType = docType.toUpperCase();

    if (!userDeptCode && !isVTLTOrAdmin) {
      return NextResponse.json({ 
        error: 'Tài khoản của bạn chưa được gán phòng ban chính. Không thể thực hiện cấp văn bản!' 
      }, { status: 403 });
    }

    if (!isVTLTOrAdmin && cleanDeptCode !== userDeptCode.toUpperCase()) {
      return NextResponse.json({ 
        error: `Bạn không có quyền tạo văn bản cho phòng ban ${cleanDeptCode}. Chỉ Văn thư Lưu trữ (VTLT) mới được phép cấp số cho phòng ban khác!` 
      }, { status: 403 });
    }

    // Xử lý lưu File đính kèm có kiểm tra dung lượng 30MB & Magic Bytes
    let fileName = null;
    if (file && typeof file === 'object' && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Dung lượng file vượt quá giới hạn cho phép (Tối đa 30MB)!' }, { status: 400 });
      }

      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Định dạng file không hỗ trợ! Chỉ chấp nhận: ${ALLOWED_EXTENSIONS.join(', ')}` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const isValidMagicBytes = await validateFileMagicBytes(buffer, ext);
      if (!isValidMagicBytes) {
        return NextResponse.json({ error: 'Tệp tải lên không khớp với định dạng thực tế (Phát hiện giả mạo phần mở rộng file)!' }, { status: 400 });
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      fileName = `Scan_${uniqueSuffix}${ext}`;
      savedFilePath = path.join(UPLOAD_DIR, fileName);

      await fs.writeFile(savedFilePath, buffer);
    }

    let currentYear = new Date().getFullYear();
    if (effectiveDate && typeof effectiveDate === 'string' && effectiveDate.length >= 4) {
      const parsedYear = parseInt(effectiveDate.substring(0, 4), 10);
      if (!isNaN(parsedYear)) {
        currentYear = parsedYear;
      }
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const counterRes = await new sql.Request(transaction)
        .input('YearParam', sql.Int, currentYear)
        .input('DeptCodeParam', sql.VarChar(20), cleanDeptCode)
        .input('DocTypeParam', sql.VarChar(20), cleanDocType)
        .query(`
          SELECT last_number 
          FROM document_counters WITH (UPDLOCK, HOLDLOCK) 
          WHERE year = @YearParam 
            AND dept_code = @DeptCodeParam 
            AND doc_type_code = @DocTypeParam
        `);

      let nextSeq = 1;

      if (counterRes.recordset.length === 0) {
        await new sql.Request(transaction)
          .input('YearParam', sql.Int, currentYear)
          .input('DeptCodeParam', sql.VarChar(20), cleanDeptCode)
          .input('DocTypeParam', sql.VarChar(20), cleanDocType)
          .input('InitNumber', sql.Int, 1)
          .query(`
            INSERT INTO document_counters (year, dept_code, doc_type_code, last_number) 
            VALUES (@YearParam, @DeptCodeParam, @DocTypeParam, @InitNumber)
          `);
      } else {
        nextSeq = counterRes.recordset[0].last_number + 1;
        await new sql.Request(transaction)
          .input('NextSeq', sql.Int, nextSeq)
          .input('YearParam', sql.Int, currentYear)
          .input('DeptCodeParam', sql.VarChar(20), cleanDeptCode)
          .input('DocTypeParam', sql.VarChar(20), cleanDocType)
          .query(`
            UPDATE document_counters 
            SET last_number = @NextSeq 
            WHERE year = @YearParam 
              AND dept_code = @DeptCodeParam 
              AND doc_type_code = @DocTypeParam
          `);
      }

      const formattedSeq = formatSequenceNumber(nextSeq);
      const fullDocumentNumber = `${formattedSeq}/${currentYear}/${cleanDocType}-${cleanDeptCode}`;

      const insertDocResult = await new sql.Request(transaction)
        .input('DocNumber', sql.NVarChar(50), fullDocumentNumber)
        .input('SeqNum', sql.Int, nextSeq)
        .input('YearParam', sql.Int, currentYear)
        .input('DocType', sql.NVarChar(10), cleanDocType)
        .input('DeptCode', sql.NVarChar(20), cleanDeptCode)
        .input('Subject', sql.NVarChar(sql.MAX), subject)
        .input('CreatedBy', sql.NVarChar(50), createdBy ? createdBy.trim() : null)
        .input('CreatedByUser', sql.VarChar(50), currentUsername)
        .input('EffectiveDate', sql.Date, effectiveDate || new Date())
        .input('ExpirationDate', sql.Date, expirationDate && expirationDate.trim() !== '' ? expirationDate : null)
        .input('FilePath', sql.NVarChar(255), fileName)
        .input('IsConfidential', sql.Bit, isConfidential)
        .query(`
          INSERT INTO documents (document_number, sequence_num, year, doc_type, dept_code, subject, created_by, created_by_user, effective_date, expiration_date, file_path, status, is_confidential)
          OUTPUT INSERTED.*
          VALUES (@DocNumber, @SeqNum, @YearParam, @DocType, @DeptCode, @Subject, @CreatedBy, @CreatedByUser, @EffectiveDate, @ExpirationDate, @FilePath, 'ACTIVE', @IsConfidential);
        `);

      await transaction.commit();

      return NextResponse.json(
        {
          message: 'Cấp số văn bản thành công!',
          data: insertDocResult.recordset[0],
        },
        { status: 201 }
      );
    } catch (err) {
      await transaction.rollback();
      if (savedFilePath && existsSync(savedFilePath)) {
        await fs.unlink(savedFilePath).catch(() => {});
      }
      throw err;
    }
  } catch (error) {
    console.error('Lỗi SQL Server khi cấp số:', error);
    if (savedFilePath && existsSync(savedFilePath)) {
      await fs.unlink(savedFilePath).catch(() => {});
    }
    return NextResponse.json({ error: error.message || 'Hệ thống gặp lỗi trong quá trình cấp số!' }, { status: 500 });
  }
}