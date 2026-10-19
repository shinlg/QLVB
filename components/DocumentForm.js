'use client';

import { useState, useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import { Vietnamese } from 'flatpickr/dist/l10n/vn.js';

export default function DocumentForm({
  departments = [],
  documentTypes = [],
  onRequestConfirm,
  resetTrigger,
}) {
  const [docType, setDocType] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState(''); // State cho ngày hết hạn
  const [createdBy, setCreatedBy] = useState('');
  const [subject, setSubject] = useState('');
  const [scanFile, setScanFile] = useState(null);
  const [isConfidential, setIsConfidential] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  const dateInputRef = useRef(null);
  const expireDateInputRef = useRef(null); // Ref cho ô ngày hết hạn
  const fileInputRef = useRef(null);
  const fpInstanceRef = useRef(null);
  const fpExpireInstanceRef = useRef(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        if (user.deptCode) {
          setDeptCode(user.deptCode);
        }
      } catch (e) {
        console.error('Lỗi parse user:', e);
      }
    }
  }, []);

  const userRoles = currentUser?.roles || [];
  const isVTLTorAdmin = userRoles.includes('VTLT') || userRoles.includes('ADMIN');

  useEffect(() => {
    if (currentUser && !isVTLTorAdmin && currentUser.deptCode) {
      setDeptCode(currentUser.deptCode);
    } else if (!deptCode && departments.length > 0) {
      setDeptCode(currentUser?.deptCode || departments[0].code);
    }
  }, [currentUser, isVTLTorAdmin, departments, deptCode]);

  useEffect(() => {
    if (documentTypes.length > 0 && !docType) {
      setDocType(documentTypes[0].code);
    }
  }, [documentTypes, docType]);

  // Khởi tạo Flatpickr cho Ngày Hiệu Lực và Ngày Hết Hiệu Lực
  useEffect(() => {
    if (dateInputRef.current) {
      const fp = flatpickr(dateInputRef.current, {
        dateFormat: 'd/m/Y',
        defaultDate: 'today',
        locale: Vietnamese,
        allowInput: true,
        onChange: (selectedDates, dateStr) => {
          setEffectiveDate(dateStr);
        },
      });
      fpInstanceRef.current = fp;
      setEffectiveDate(fp.formatDate(new Date(), 'd/m/Y'));
    }

    if (expireDateInputRef.current) {
      const fpExpire = flatpickr(expireDateInputRef.current, {
        dateFormat: 'd/m/Y',
        locale: Vietnamese,
        allowInput: true,
        onChange: (selectedDates, dateStr) => {
          setExpirationDate(dateStr);
        },
      });
      fpExpireInstanceRef.current = fpExpire;
    }

    return () => {
      if (fpInstanceRef.current) fpInstanceRef.current.destroy();
      if (fpExpireInstanceRef.current) fpExpireInstanceRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    if (resetTrigger) {
      setSubject('');
      setScanFile(null);
      setIsConfidential(false);
      setExpirationDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (currentUser?.deptCode && !isVTLTorAdmin) {
        setDeptCode(currentUser.deptCode);
      }

      if (fpInstanceRef.current) {
        fpInstanceRef.current.setDate(new Date());
        setEffectiveDate(fpInstanceRef.current.formatDate(new Date(), 'd/m/Y'));
      }

      if (fpExpireInstanceRef.current) {
        fpExpireInstanceRef.current.clear();
      }
    }
  }, [resetTrigger, currentUser, isVTLTorAdmin]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanSubject = subject.trim();
    if (!cleanSubject) {
      alert('Vui lòng nhập Trích yếu nội dung!');
      return;
    }

    if (!docType) {
      alert('Vui lòng chọn Loại văn bản!');
      return;
    }

    if (!deptCode) {
      alert('Vui lòng chọn Phòng ban!');
      return;
    }

    // Chuyển định dạng ngày hiệu lực d/m/Y sang YYYY-MM-DD
    let isoDate = '';
    if (effectiveDate && effectiveDate.includes('/')) {
      const [day, month, year] = effectiveDate.split('/');
      isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      isoDate = new Date().toISOString().split('T')[0];
    }

    // Chuyển định dạng ngày hết hiệu lực (nếu có)
    let isoExpireDate = '';
    if (expirationDate && expirationDate.includes('/')) {
      const [day, month, year] = expirationDate.split('/');
      isoExpireDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    if (onRequestConfirm) {
      onRequestConfirm({
        docType,
        deptCode,
        createdBy: createdBy.trim(),
        effectiveDate: isoDate,
        expirationDate: isoExpireDate || null, // Truyền ngày hết hạn
        subject: cleanSubject,
        file: scanFile,
        isConfidential,
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
      <h2 className="text-lg font-bold border-b pb-3 mb-4 flex items-center gap-2 text-slate-800">
        <i className="fa-solid fa-pen-to-square text-blue-600"></i>
        Tạo Văn Bản / Tờ Trình Mới
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            Loại Văn Bản <span className="text-red-500">*</span>
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {documentTypes.length === 0 ? (
              <option value="">-- Đang tải loại văn bản... --</option>
            ) : (
              documentTypes.map((t) => (
                <option key={t.id || t.code} value={t.code}>
                  {t.name} ({t.code})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            Phòng Ban Ban Hành <span className="text-red-500">*</span>
          </label>
          <select
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
            disabled={!isVTLTorAdmin}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
          >
            {departments.length === 0 ? (
              <option value="">-- Đang tải danh sách... --</option>
            ) : (
              departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} ({d.code})
                </option>
              ))
            )}
          </select>
          {!isVTLTorAdmin && (
            <p className="text-[11px] text-slate-400 mt-1">
              * Bạn thuộc phòng ban <strong className="text-slate-600">{currentUser?.deptCode || 'Chưa gán'}</strong>. Chỉ Văn thư Lưu trữ (VTLT) mới có quyền đổi phòng ban khác.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            Ngày Hiệu Lực <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              ref={dateInputRef}
              type="text"
              required
              placeholder="dd/mm/yyyy"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer pr-10"
            />
            <i className="fa-regular fa-calendar absolute right-3 top-2.5 text-slate-400 pointer-events-none"></i>
          </div>
        </div>

        {/* BỔ SUNG: Ô CHỌN NGÀY HẾT HIỆU LỰC (TÙY CHỌN) */}
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            Ngày Hết Hiệu Lực <span className="text-slate-400 font-normal text-xs">(Tùy chọn)</span>
          </label>
          <div className="relative">
            <input
              ref={expireDateInputRef}
              type="text"
              placeholder="dd/mm/yyyy"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer pr-10"
            />
            <i className="fa-regular fa-calendar-xmark absolute right-3 top-2.5 text-slate-400 pointer-events-none"></i>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Để trống nếu văn bản có hiệu lực vô thời hạn.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">Người Yêu Cầu</label>
          <input
            type="text"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="Tên người yêu cầu"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            Trích Yếu Nội Dung <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nhập tóm tắt nội dung..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">File Scan Văn Bản (PDF/Ảnh)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setScanFile(e.target.files[0] || null)}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded-lg cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isConfidentialCheck"
            checked={isConfidential}
            onChange={(e) => setIsConfidential(e.target.checked)}
            className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
          />
          <label htmlFor="isConfidentialCheck" className="text-xs font-bold text-red-600 flex items-center gap-1.5 cursor-pointer select-none">
            <i className="fa-solid fa-lock"></i> Đánh dấu văn bản bảo mật (Chỉ người tạo, TP cùng phòng & BGĐ xem được)
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow cursor-pointer"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Cấp Số Văn Bản</span>
        </button>
      </form>
    </div>
  );
}