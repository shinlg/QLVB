import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Sử dụng chung Khóa bí mật với API Login
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'SuperSecretKeyForQLVB2026SecureAuthentication!@#'
);

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Cho phép truy cập trang login và các tài nguyên tĩnh/API auth
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 1. Kiểm tra token đăng nhập (Signed JWT)
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Xác thực chữ ký số và giải mã token an toàn tuyệt đối từ Server
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Lấy danh sách roles từ payload đã được mã hóa (chống giả mạo 100%)
    const roles = payload.roles || ['USER'];

    // Kiểm tra xem user có quyền đặc biệt tạo tờ trình không (VTBP, VTLT, ADMIN)
    const hasPrivilegedRole = 
      roles.includes('VTBP') || 
      roles.includes('VTLT') || 
      roles.includes('ADMIN');

    // 2. PHÂN QUYỀN TRANG CHỦ CẤP SỐ (/)
    // Nếu user cố truy cập '/' mà KHÔNG có quyền VTBP/VTLT/ADMIN -> Chặn và đẩy về /search
    if (pathname === '/') {
      if (!hasPrivilegedRole) {
        return NextResponse.redirect(new URL('/search', request.url));
      }
    }

    // 3. KIỂM TRA PHÂN QUYỀN CHO KHU VỰC ADMIN (/admin hoặc /api/admin)
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (!roles.includes('ADMIN')) {
        const fallbackUrl = hasPrivilegedRole ? '/' : '/search';
        return NextResponse.redirect(new URL(fallbackUrl, request.url));
      }
    }

    // Nếu token hợp lệ và qua các màng lọc phân quyền -> Cho phép đi tiếp
    return NextResponse.next();

  } catch (err) {
    // Nếu token bị giả mạo, sai chữ ký, hoặc hết hạn -> Xóa session và đá về trang login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};