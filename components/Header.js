'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Tải thông tin người dùng từ sessionStorage
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Lỗi parse user data:', e);
      }
    }
  }, []);

  const handleLogout = async () => {
    // Gọi API logout để xóa sạch cookie bảo mật ở server
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Lỗi logout:', e);
    }
    
    sessionStorage.clear();
    window.location.href = '/login';
  };

  // Kiểm tra user có quyền ADMIN hay không dựa vào mảng roles
  const isAdmin = user && Array.isArray(user.roles) && user.roles.includes('ADMIN');

  return (
    <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* KHỐI LOGO & TIÊU ĐỀ */}
        <div className="flex items-center gap-3.5">
          <Link href="/" className="relative w-12 h-12 flex-shrink-0 block">
            <Image
              src="/logo.png"
              alt="MARSAMC Logo"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </Link>

          <div>
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                Quản Lý Văn Bản Nội Bộ MARSAMC
              </h1>
            </Link>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Cấp số tự động & lưu trữ file scan văn bản
            </p>
          </div>
        </div>

        {/* KHỐI TRẠNG THÁI & TÀI KHOẢN / ADMIN CENTER */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Sẵn sàng
          </span>

          {user ? (
            <>
              {/* CHỈ HIỂN THỊ NÚT ADMIN CENTER NẾU USER CÓ ROLE ADMIN */}
              {isAdmin && (
                <Link 
                  href="/admin/users" 
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-all flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-user-gear text-blue-600"></i>
                  Admin Center
                </Link>
              )}

              {/* Thông tin User */}
              <div className="text-right px-2 border-l border-slate-200">
                <p className="text-xs font-bold text-slate-800">{user.fullName || user.username}</p>
                <p className="text-[10px] text-slate-500 font-medium">{user.deptCode}</p>
              </div>

              {/* Nút Đăng xuất */}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                title="Đăng xuất"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                Đăng xuất
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            >
              <i className="fa-solid fa-right-to-bracket"></i>
              Đăng nhập
            </Link>
          )}

        </div>

      </div>
    </header>
  );
}