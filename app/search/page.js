'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';

export default function DocumentSearchPage() {
  const [departments, setDepartments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [keyword, setKeyword] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  
  // ĐẶT MẶC ĐỊNH TRẠNG THÁI LÀ 'ACTIVE' (Đang hiệu lực)
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');

  // Khởi tạo giá trị ref ban đầu khớp với state mặc định để gọi API chính xác
  const searchFilterRef = useRef({ keyword: '', deptCode: '', status: 'ACTIVE' });
  const searchTimeoutRef = useRef(null);

  // Lấy danh sách phòng ban từ /api/departments
  useEffect(() => {
    fetch('/api/departments')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDepartments(list);
      })
      .catch((err) => console.error('Lỗi tải phòng ban:', err));
  }, []);

  // Gọi API lấy danh sách văn bản (có hỗ trợ lọc theo trạng thái)
  const fetchDocuments = useCallback(async (page = 1, q = '', deptCode = '', status = 'ACTIVE') => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');
      if (q) queryParams.append('q', q);
      if (deptCode) queryParams.append('deptCode', deptCode);
      if (status) queryParams.append('status', status);

      const res = await fetch(`/api/documents?${queryParams.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setDocuments(result.data || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    } catch (err) {
      console.error('Lỗi lấy dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải dữ liệu lần đầu tiên với mặc định status = 'ACTIVE'
  useEffect(() => {
    fetchDocuments(1, '', '', 'ACTIVE');
  }, [fetchDocuments]);

  // Debounce tìm kiếm 300ms
  const handleKeywordChange = (e) => {
    const val = e.target.value;
    setKeyword(val);
    searchFilterRef.current.keyword = val;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchDocuments(1, val, selectedDept, selectedStatus);
    }, 300);
  };

  const handleDeptChange = (e) => {
    const val = e.target.value;
    setSelectedDept(val);
    searchFilterRef.current.deptCode = val;
    fetchDocuments(1, keyword, val, selectedStatus);
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;
    setSelectedStatus(val);
    searchFilterRef.current.status = val;
    fetchDocuments(1, keyword, selectedDept, val);
  };

  const handlePageChange = (newPage) => {
    const { keyword: k, deptCode: d, status: s } = searchFilterRef.current;
    fetchDocuments(newPage, k, d, s);
  };

  const formatDateVN = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? '—'
      : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-magnifying-glass text-blue-600"></i>
                Tra Cứu Tờ Trình & Văn Bản
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Chế độ xem thông tin và tải file scan đính kèm
              </p>
            </div>
          </div>

          {/* Ô TÌM KIẾM, PHÒNG BAN VÀ TRẠNG THÁI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-sm"></i>
              <input
                type="text"
                value={keyword}
                onChange={handleKeywordChange}
                placeholder="Nhập số tờ trình, trích yếu, người tạo..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <select
                value={selectedDept}
                onChange={handleDeptChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
              >
                <option value="">-- Tất cả phòng ban --</option>
                {departments.map((dept) => {
                  const code = dept.dept_code || dept.code;
                  const name = dept.dept_name || dept.name;
                  return (
                    <option key={dept.id || code} value={code}>
                      {name} ({code})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <select
                value={selectedStatus}
                onChange={handleStatusChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="ACTIVE">🟢 Đang hiệu lực</option>
                <option value="EXPIRED">🟡 Đã hết hạn</option>
                <option value="CANCELLED">🔴 Đã hủy</option>
              </select>
            </div>
          </div>

          {/* BẢNG DANH SÁCH */}
          <div className="relative overflow-x-auto min-h-[420px] border border-slate-200/80 rounded-xl">
            {loading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-md border border-slate-200 text-sm text-blue-600 font-semibold">
                  <i className="fa-solid fa-spinner animate-spin"></i> Đang tải dữ liệu...
                </div>
              </div>
            )}

            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase">
                  <th className="p-3.5">Số Tờ Trình</th>
                  <th className="p-3.5">Trích Yếu Nội Dung</th>
                  <th className="p-3.5">Thời Gian Hiệu Lực</th>
                  <th className="p-3.5 text-center">File Scan</th>
                  <th className="p-3.5 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">
                      Không tìm thấy dữ liệu phù hợp.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const isCancelled = doc.computed_status === 'CANCELLED' || doc.status === 'CANCELLED';
                    const isExpired = doc.computed_status === 'EXPIRED';
                    const isConfidential = doc.is_confidential === 1 || doc.is_confidential === true;

                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isCancelled ? 'bg-red-50/40' : isExpired ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="p-3.5 align-top whitespace-nowrap">
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
                        </td>

                        <td className="p-3.5 align-top text-slate-700 max-w-xs" title={doc.subject}>
                          <div className={`font-medium line-clamp-2 ${isCancelled ? 'line-through text-slate-400' : isExpired ? 'text-slate-600' : ''}`}>
                            {doc.subject}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Người yêu cầu: <strong>{doc.created_by || '—'}</strong>
                          </div>
                        </td>

                        <td className="p-3.5 align-top text-slate-600 text-xs whitespace-nowrap">
                          <div className="font-semibold">{formatDateVN(doc.effective_date)}</div>
                          {doc.expiration_date ? (
                            <div className={`text-[11px] mt-0.5 ${isExpired ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                              Đến: {formatDateVN(doc.expiration_date)}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic mt-0.5">Vô thời hạn</div>
                          )}
                        </td>

                        <td className="p-3.5 align-top text-center">
                          {doc.file_path && !isCancelled ? (
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                            >
                              <i className="fa-solid fa-file-pdf text-red-500"></i> Xem File
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa có</span>
                          )}
                        </td>

                        <td className="p-3.5 align-top text-center">
                          {isCancelled ? (
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <i className="fa-solid fa-ban text-[10px]"></i> Đã Hủy
                            </span>
                          ) : isExpired ? (
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <i className="fa-solid fa-triangle-exclamation text-[10px]"></i> Hết Hạn
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <i className="fa-solid fa-check text-[10px]"></i> Hoạt Động
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PHÂN TRANG */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <div>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages || 1}</strong> (Tổng <strong>{pagination.total}</strong> tờ trình)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 transition-colors"
              >
                ⬅ Trước
              </button>

              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 transition-colors"
              >
                Sau ➡
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}