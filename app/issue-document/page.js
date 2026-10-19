'use client';

import { useState, useEffect } from 'react';

export default function IssueDocumentPage() {
  // State Phòng Ban
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // State Form Cấp Văn Bản / Tờ Trình
  const [formData, setFormData] = useState({
    documentNumber: '',
    subject: '',
    deptCode: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    createdBy: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Lấy danh sách phòng ban từ /api/departments (Gồm id, dept_code, dept_name)
  useEffect(() => {
    setLoadingDepts(true);
    fetch('/api/departments')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDepartments(list);
        if (list.length > 0) {
          const defaultCode = list[0].dept_code || list[0].code || '';
          setFormData((prev) => ({ ...prev, deptCode: defaultCode }));
        }
      })
      .catch((err) => console.error('Lỗi tải danh sách phòng ban:', err))
      .finally(() => setLoadingDepts(false));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.documentNumber.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số tờ trình / văn bản!' });
      return;
    }

    if (!formData.subject.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập trích yếu nội dung!' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('document_number', formData.documentNumber);
      payload.append('subject', formData.subject);
      payload.append('dept_code', formData.deptCode);
      payload.append('effective_date', formData.effectiveDate);
      payload.append('created_by', formData.createdBy);

      if (selectedFile) {
        payload.append('file', selectedFile);
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: payload,
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message || 'Tạo văn bản / tờ trình mới thành công!' });
        setFormData({
          documentNumber: '',
          subject: '',
          deptCode: departments[0]?.dept_code || departments[0]?.code || '',
          effectiveDate: new Date().toISOString().split('T')[0],
          createdBy: '',
        });
        setSelectedFile(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Lỗi cấp văn bản!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi kết nối máy chủ!' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER VÀ NÚT QUAY LẠI TRANG CHỦ */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-file-signature text-blue-600"></i>
              Tạo Văn Bản & Tờ Trình Mới
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Khởi tạo và lưu trữ số hiệu văn bản hành chính vào hệ thống
            </p>
          </div>

          {/* ĐIỀU HƯỚNG TRỰC TIẾP VỀ TRANG CHỦ LOCALHOST:3000 */}
          <button
            onClick={() => { window.location.href = '/'; }}
            className="flex items-center gap-2 text-xs font-bold px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors self-start sm:self-center cursor-pointer"
          >
            ⬅ Quay Lại Trang Chủ
          </button>
        </div>

        {/* FORM NHẬP THÔNG TIN VĂN BẢN / TỜ TRÌNH */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {message.text && (
              <div
                className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* SỐ VĂN BẢN / TỜ TRÌNH */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Số Tờ Trình / Số Văn Bản <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="documentNumber"
                  required
                  value={formData.documentNumber}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 03/2026/TTr-BGD"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* PHÒNG BAN BAN HÀNH */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Phòng Ban Ban Hành <span className="text-red-500">*</span>
                </label>
                <select
                  name="deptCode"
                  value={formData.deptCode}
                  onChange={handleInputChange}
                  disabled={loadingDepts}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingDepts ? (
                    <option value="">Đang tải danh sách phòng ban...</option>
                  ) : departments.length === 0 ? (
                    <option value="">Không có dữ liệu phòng ban</option>
                  ) : (
                    departments.map((dept) => {
                      const code = dept.dept_code || dept.code;
                      const name = dept.dept_name || dept.name;
                      return (
                        <option key={dept.id || code} value={code}>
                          {name} ({code})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>

            {/* TRÍCH YẾU NỘI DUNG */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Trích Yếu Nội Dung <span className="text-red-500">*</span>
              </label>
              <textarea
                name="subject"
                required
                rows={3}
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Nhập tóm tắt trích yếu nội dung văn bản / tờ trình..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* NGÀY HIỆU LỰC */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Ngày Hiệu Lực / Ban Hành
                </label>
                <input
                  type="date"
                  name="effectiveDate"
                  value={formData.effectiveDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* NGƯỜI LẬP / NGƯỜI TRÌNH */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Người Lập / Người Trình
                </label>
                <input
                  type="text"
                  name="createdBy"
                  value={formData.createdBy}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* UPLOAD FILE SCAN PDF */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                File Đính Kèm (File Scan PDF / Word)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.png"
                onChange={handleFileChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
              />
            </div>

            {/* NÚT SUBMIT */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    Đang Tạo...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Phát Hành & Cấp Số
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}