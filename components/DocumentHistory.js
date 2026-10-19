'use client';

import { useState, useRef, useEffect } from 'react';

export default function DocumentHistory({
  documents = [],
  departments = [],
  loading = false,
  pagination = { page: 1, totalPages: 1, total: 0, limit: 10 },
  onRefresh,
  onSearchChange,
  onPageChange,
}) {
  const [selectedDept, setSelectedDept] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // Bộ lọc nhanh theo trạng thái động
  const [selectedDocIdForUpload, setSelectedDocIdForUpload] = useState(null);

  // State lưu thông tin user hiện tại để phân quyền nút Sửa / Hủy
  const [currentUser, setCurrentUser] = useState(null);

  // State cho Modal Chỉnh Sửa
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editSubject, setEditSubject] = useState('');
  const [editCreatedBy, setEditCreatedBy] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const extraFileInputRef = useRef(null);

  // Lấy thông tin user từ sessionStorage khi load component
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Lỗi parse user:', e);
      }
    }
  }, []);

  const userRoles = currentUser?.roles || [];
  const userDeptCode = currentUser?.primary_dept_code || currentUser?.deptCode || '';

  const isVTLTOrAdmin = userRoles.includes('VTLT') || userRoles.includes('ADMIN');
  const isVTBP = userRoles.includes('VTBP');
  const isTP = userRoles.includes('TP');
  const isCancelRole = userRoles.includes('CANCEL');

  const formatDateVN = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleKeywordChange = (e) => {
    const val = e.target.value;
    setKeyword(val);
    if (onSearchChange) onSearchChange(val, selectedDept, statusFilter);
  };

  const handleDeptChange = (e) => {
    const val = e.target.value;
    setSelectedDept(val);
    if (onSearchChange) onSearchChange(keyword, val, statusFilter);
  };

  const handleStatusFilterChange = (e) => {
    const val = e.target.value;
    setStatusFilter(val);
    if (onSearchChange) onSearchChange(keyword, selectedDept, val);
  };

  const triggerFileUpload = (docId) => {
    setSelectedDocIdForUpload(docId);
    if (extraFileInputRef.current) {
      extraFileInputRef.current.value = '';
      extraFileInputRef.current.click();
    }
  };

  const handleExtraFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!selectedDocIdForUpload || !file) return;

    const formData = new FormData();
    formData.append('scanFile', file);

    try {
      const res = await fetch(`/api/documents/${selectedDocIdForUpload}/upload`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (res.ok) {
        alert('Bổ sung file scan thành công!');
        if (onRefresh) onRefresh();
      } else {
        alert('Lỗi: ' + (result.error || 'Không thể upload file!'));
      }
    } catch (error) {
      alert('Lỗi kết nối tới Server Backend!');
    } finally {
      setSelectedDocIdForUpload(null);
    }
  };

  // Mở Popup Sửa
  const handleOpenEditModal = (doc) => {
    setEditingDoc(doc);
    setEditSubject(doc.subject || '');
    setEditCreatedBy(doc.created_by || '');
    setIsEditModalOpen(true);
  };

  // Đóng Popup Sửa
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingDoc(null);
    setEditSubject('');
    setEditCreatedBy('');
  };

  // Gửi request cập nhật
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (!editSubject.trim()) {
      alert('Vui lòng nhập trích yếu nội dung!');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/documents/${editingDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editSubject.trim(),
          created_by: editCreatedBy.trim(),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        alert('Cập nhật thông tin tờ trình thành công!');
        handleCloseEditModal();
        if (onRefresh) onRefresh();
      } else {
        alert('Lỗi: ' + (result.error || 'Không thể cập nhật thông tin!'));
      }
    } catch (error) {
      alert('Lỗi kết nối tới Server Backend!');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelDocument = async (docId, docNumber) => {
    const reason = prompt(
      `Bạn có chắc chắn muốn HỦY số [${docNumber}]?\n\nVui lòng nhập lý do hủy:`
    );

    if (reason === null) return;
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do hủy số!');
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const result = await res.json();

      if (res.ok) {
        alert(`Đã hủy số ${docNumber} thành công!`);
        if (onRefresh) onRefresh();
      } else {
        alert('Lỗi: ' + (result.error || 'Không thể hủy số!'));
      }
    } catch (error) {
      alert('Lỗi kết nối tới Server Backend!');
    }
  };

  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const totalRecords = pagination?.total || documents.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <input
        ref={extraFileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleExtraFileUpload}
        className="hidden"
      />

      {/* HEADER & TÌM KIẾM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <i className="fa-solid fa-clock-rotate-left text-blue-600"></i>
          Danh Sách Tờ Trình
        </h2>

        <button
          onClick={onRefresh}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 w-fit cursor-pointer"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm"></i>
          <input
            type="text"
            value={keyword}
            onChange={handleKeywordChange}
            placeholder="Tìm theo số tờ trình, nội dung, người tạo..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <select
            value={selectedDept}
            onChange={handleDeptChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value="">-- Tất cả phòng ban --</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="ACTIVE">🟢 Đang hiệu lực</option>
            <option value="EXPIRED">🟡 Đã hết hạn</option>
            <option value="CANCELLED">🔴 Đã hủy</option>
          </select>
        </div>
      </div>

      {/* VÙNG CHỨA BẢNG CÓ MIN-HEIGHT & OVERLAY LOADING */}
      <div className="relative overflow-x-auto min-h-[420px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center transition-all">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-md border text-sm text-blue-600 font-medium">
              <i className="fa-solid fa-spinner animate-spin"></i> Đang tải dữ liệu...
            </div>
          </div>
        )}

        <table className="w-full text-left text-sm border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <th className="p-3 w-48">Số Tờ Trình</th>
              <th className="p-3 w-auto">Trích Yếu Nội Dung</th>
              <th className="p-3 w-32 text-center">Thời Gian HL</th>
              <th className="p-3 w-24 text-center">File Scan</th>
              <th className="p-3 w-36 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Không tìm thấy tờ trình phù hợp.
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isCancelled = doc.computed_status === 'CANCELLED' || doc.status === 'CANCELLED';
                const isExpired = doc.computed_status === 'EXPIRED';
                const isActive = !isCancelled && !isExpired;

                const isConfidential = doc.is_confidential === 1 || doc.is_confidential === true;

                const isOwner = doc.created_by_user === currentUser?.username;
                const isTPOfDept = isTP && userDeptCode && doc.dept_code?.toUpperCase() === userDeptCode.toUpperCase();

                // CHẶN: Văn bản đã hết hạn hoặc đã hủy -> Tuyệt đối không cho phép Sửa/Hủy (Read-only)
                const canEdit = isActive && (isVTLTOrAdmin || (isVTBP && isOwner) || isTPOfDept);
                const canCancel = isActive && (isVTLTOrAdmin || isCancelRole || isTPOfDept);

                return (
                  <tr
                    key={doc.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isCancelled ? 'bg-red-50/60' : isExpired ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    {/* Số Tờ Trình & Huy hiệu Trạng Thái tách dòng gọn gàng */}
                    <td className="p-3 align-top whitespace-nowrap">
                      <div className={`font-bold font-mono ${isCancelled ? 'text-slate-400 line-through' : isExpired ? 'text-amber-700' : 'text-blue-600'}`}>
                        {doc.document_number}

                        {isConfidential && (
                          <span 
                            className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 border border-amber-200 align-middle"
                            title="Tài liệu bảo mật nội bộ"
                          >
                            <i className="fa-solid fa-lock text-[9px]"></i>
                          </span>
                        )}
                      </div>

                      {/* Huy hiệu Trạng Thái nằm gọn bên dưới số tờ trình */}
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {isCancelled && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 border border-red-200">
                            <i className="fa-solid fa-ban text-[9px]"></i> ĐÃ HỦY
                          </span>
                        )}

                        {isExpired && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 border border-amber-300" title={`Hết hạn ngày: ${formatDateVN(doc.expiration_date)}`}>
                            <i className="fa-solid fa-triangle-exclamation text-[9px]"></i> HẾT HẠN
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Trích Yếu Nội Dung */}
                    <td className="p-3 align-top text-slate-700" title={doc.subject}>
                      <p
                        className={`font-medium line-clamp-2 ${
                          isCancelled ? 'text-slate-400 line-through' : isExpired ? 'text-slate-600' : ''
                        }`}
                      >
                        {doc.subject}
                      </p>
                      <div className="text-xs text-slate-400 font-normal mt-1 flex items-center gap-2">
                        <span>Người yêu cầu: <strong>{doc.created_by || '—'}</strong></span>
                        <span>•</span>
                        <span>Tạo bởi: {doc.created_by_user || '—'}</span>
                      </div>
                    </td>

                    {/* Thời Gian HL */}
                    <td
                      className={`p-3 align-top text-slate-600 text-xs text-center whitespace-nowrap ${
                        isCancelled ? 'text-slate-400' : ''
                      }`}
                    >
                      <div className="font-semibold">{formatDateVN(doc.effective_date)}</div>
                      {doc.expiration_date ? (
                        <div className={`text-[11px] mt-0.5 ${isExpired ? 'text-amber-700 font-semibold' : 'text-slate-400'}`} title="Ngày hết hiệu lực">
                          Đến: {formatDateVN(doc.expiration_date)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic mt-0.5">Vô thời hạn</div>
                      )}
                    </td>

                    {/* File Scan */}
                    <td className="p-3 align-top text-center">
                      {!isCancelled ? (
                        doc.file_path ? (
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition-colors"
                          >
                            <i className="fa-solid fa-file-pdf text-red-500"></i> Xem
                          </a>
                        ) : canEdit ? (
                          <button
                            onClick={() => triggerFileUpload(doc.id)}
                            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-300 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-cloud-arrow-up text-amber-600"></i> Upload
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có file</span>
                        )
                      ) : (
                        <span className="text-xs text-slate-300 italic">—</span>
                      )}
                    </td>

                    {/* Thao Tác */}
                    <td className="p-3 align-top text-center">
                      {isCancelled ? (
                        <div className="bg-red-50 p-1.5 rounded border border-red-100 text-left">
                          <span className="text-[11px] text-red-600 font-medium block truncate" title={doc.cancel_reason}>
                            <i className="fa-solid fa-circle-info mr-1"></i> Lý do: {doc.cancel_reason || 'Không rõ'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(doc)}
                              title="Sửa thông tin"
                              className="text-xs text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2.5 py-1 rounded border border-slate-200 transition-colors cursor-pointer"
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Sửa
                            </button>
                          )}

                          {canCancel && (
                            <button
                              onClick={() => handleCancelDocument(doc.id, doc.document_number)}
                              title="Hủy số tờ trình"
                              className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded border border-red-200 transition-colors cursor-pointer"
                            >
                              <i className="fa-solid fa-ban"></i> Hủy
                            </button>
                          )}

                          {!canEdit && !canCancel && (
                            <span className="text-xs text-slate-400 italic">Chỉ xem</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CỤM NÚT CHUYỂN TRANG */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
        <div>
          Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Tổng cộng <strong>{totalRecords}</strong> tờ trình)
        </div>

        <div className="flex items-center gap-1.5">
          <button
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-chevron-left mr-1"></i> Trang trước
          </button>

          <button
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
          >
            Trang sau <i className="fa-solid fa-chevron-right ml-1"></i>
          </button>
        </div>
      </div>

      {/* MODAL CẬP NHẬT THÔNG TIN TỜ TRÌNH */}
      {isEditModalOpen && editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-blue-600"></i>
                Sửa Thông Tin Tờ Trình [{editingDoc.document_number}]
              </h3>
              <button
                onClick={handleCloseEditModal}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trích Yếu Nội Dung <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Nhập trích yếu nội dung tờ trình..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Người Yêu Cầu / Tạo Văn Bản
                </label>
                <input
                  type="text"
                  value={editCreatedBy}
                  onChange={(e) => setEditCreatedBy(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i> Đang lưu...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i> Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}