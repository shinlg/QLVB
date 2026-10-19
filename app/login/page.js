'use client';

import { useState } from 'react';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Hàm xác định URL đích dựa vào danh sách roles
  const getRedirectUrl = (roles = []) => {
    const hasPrivilegedRole =
      roles.includes('VTBP') ||
      roles.includes('VTLT') ||
      roles.includes('ADMIN');

    // Nếu có quyền VTBP, VTLT hoặc ADMIN -> Chuyển về trang cấp tờ trình (/)
    // Ngược lại (chỉ có quyền USER) -> Chuyển về trang tra cứu (/search)
    return hasPrivilegedRole ? '/' : '/search';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        // Kiểm tra linh hoạt cả 2 kiểu thuộc tính: mustChangePassword hoặc must_change_password (1/true)
        const mustChange = Boolean(
          data.user.mustChangePassword || data.user.must_change_password
        );

        if (mustChange) {
          setLoggedInUser(data.user);
          setShowChangePass(true);
        } else {
          // 1. Lưu thông tin user vào sessionStorage
          sessionStorage.setItem('user', JSON.stringify(data.user));

          // 2. Lưu cookie user_roles để Middleware có thể đọc và phân quyền
          const userRoles = data.user.roles || ['USER'];
          document.cookie = `user_roles=${userRoles.join(',')}; path=/; max-age=86400; SameSite=Lax`;
          document.cookie = `auth_token=${data.user.username}; path=/; max-age=86400; SameSite=Lax`;

          // 3. Điều hướng thông minh dựa theo role
          const targetUrl = getRedirectUrl(userRoles);
          window.location.href = targetUrl;
        }
      } else {
        setError(data.error || 'Đăng nhập thất bại.');
      }
    } catch (err) {
      setError('Lỗi kết nối Server!');
    } finally {
      setLoading(false);
    }
  };

  // Hàm callback kích hoạt sau khi đổi mật khẩu thành công trong Modal
  const handlePasswordChangeSuccess = () => {
    if (!loggedInUser) return;

    const userRoles = loggedInUser.roles || ['USER'];

    // Cập nhật trạng thái must_change_password thành false
    const updatedUser = {
      ...loggedInUser,
      mustChangePassword: false,
      must_change_password: 0,
    };

    sessionStorage.setItem('user', JSON.stringify(updatedUser));
    document.cookie = `user_roles=${userRoles.join(',')}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `auth_token=${updatedUser.username}; path=/; max-age=86400; SameSite=Lax`;

    // Điều hướng thông minh dựa theo role
    const targetUrl = getRedirectUrl(userRoles);
    window.location.href = targetUrl;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-red-700 p-6 text-center text-white font-bold text-lg">
          QUẢN LÝ VĂN BẢN MARSAMC
        </div>
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tài khoản</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Nhập tên đăng nhập..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Nhập mật khẩu..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
            Đăng Nhập
          </button>
        </form>
      </div>

      {showChangePass && (
        <ChangePasswordModal 
          username={loggedInUser?.username} 
          onSuccess={handlePasswordChangeSuccess} 
        />
      )}
    </div>
  );
}