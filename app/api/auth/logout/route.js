import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Đã đăng xuất thành công' });
  
  // Xóa sạch cookie xác thực và phân quyền
  res.cookies.set({ name: 'auth_token', value: '', maxAge: 0, path: '/' });
  res.cookies.set({ name: 'user_roles', value: '', maxAge: 0, path: '/' });
  res.cookies.set({ name: 'user_role', value: '', maxAge: 0, path: '/' });

  return res;
}