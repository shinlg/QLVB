'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const IDLE_LIMIT = 5 * 60 * 1000; // 5 phút không tương tác
const WARNING_DURATION = 60;      // 60 giây đếm ngược cảnh báo

export default function SessionManager() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_DURATION);
  const idleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Tự động lưu nháp dữ liệu ô nhập liệu trước khi logout
  const autoSaveDraftForms = () => {
    if (typeof window === 'undefined') return;
    const subjectInput = document.querySelector('input[name="subject"], textarea[name="subject"]');
    if (subjectInput && subjectInput.value.trim() !== '') {
      localStorage.setItem('DMS_DRAFT_SUBJECT', subjectInput.value);
    }
  };

  // Hàm xử lý Đăng xuất chuẩn
  const handleLogout = useCallback(async () => {
    // 1. Dừng tất cả các bộ đếm ngay lập tức
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    // 2. Ẩn ngay lập tức bảng thông báo
    setShowWarning(false);

    autoSaveDraftForms();

    // 3. Xóa sạch dữ liệu phía client trước
    sessionStorage.clear();
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'user_roles=; path=/; max-age=0; SameSite=Lax';

    // 4. Gọi API logout ngầm ở server (không cần await để tránh bị nghẽn nếu mạng chậm)
    fetch('/api/auth/logout', { method: 'POST' }).catch((e) => {
      console.error('Lỗi khi gọi API logout:', e);
    });

    // 5. Chuyển hướng dứt khoát bằng window.location.href để reset hoàn toàn ứng dụng
    window.location.href = '/login?reason=timeout';
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    setCountdown(WARNING_DURATION);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    idleTimerRef.current = setTimeout(() => {
      autoSaveDraftForms();
      setShowWarning(true);
      startCountdown();
    }, IDLE_LIMIT);
  }, [startCountdown]);

  // Hàm xử lý khi người dùng chọn "Duy Trì Làm Việc"
  const handleStayLoggedIn = () => {
    setShowWarning(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    startIdleTimer(); // Reset lại từ đầu chu kỳ 5 phút
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'wheel'];
    
    const resetTimer = () => {
      if (!showWarning) {
        startIdleTimer();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    startIdleTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [showWarning, startIdleTimer]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
          <i className="fa-solid fa-clock-rotate-left"></i>
        </div>
        <h3 className="text-lg font-bold text-slate-800">Cảnh Báo Hết Phiên Làm Việc</h3>
        <p className="text-xs text-slate-600 mt-2">
          Bạn không có tương tác trong 5 phút qua. Dữ liệu văn bản đang nhập đã được lưu tạm. Hệ thống sẽ tự đăng xuất sau:
        </p>
        <div className="my-4 text-3xl font-extrabold text-amber-600 font-mono">
          {countdown}s
        </div>
        <div className="flex gap-3 justify-center">
          {/* Nút Đăng Xuất Ngay */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Đăng Xuất Ngay
          </button>
          
          {/* Nút Duy Trì Làm Việc */}
          <button
            onClick={handleStayLoggedIn}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors cursor-pointer"
          >
            Duy Trì Làm Việc
          </button>
        </div>
      </div>
    </div>
  );
}