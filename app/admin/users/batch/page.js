'use client';

import { useState, useEffect } from 'react';

export default function BatchUsersPage() {
  const [departments, setDepartments] = useState([]);
  const [rawText, setRawText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Tải danh sách phòng ban để người dùng đối chiếu mã
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await fetch('/api/departments');
        const data = await res.json();
        if (Array.isArray(data)) {
          setDepartments(data);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách phòng ban:', err);
      }
    }
    fetchDepartments();
  }, []);

  const handleBatchInsert = async () => {
    if (!rawText.trim()) return alert('Vui lòng nhập danh sách!');
    setLoading(true);

    const lines = rawText.trim().split('\n');
    const users = lines.map(line => {
      const [username, fullName, primaryDeptCode] = line.split('|').map(item => item?.trim());
      return { 
        username, 
        fullName, 
        primaryDeptCode: primaryDeptCode || (departments[0]?.dept_code || 'NSDVHC') 
      };
    }).filter(u => u.username && u.fullName);

    try {
      const res = await fetch('/api/admin/users/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert('Lỗi gửi dữ liệu!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-8 p-6 bg-white rounded-2xl shadow-md border border-slate-200">
      <h2 className="text-xl font-bold mb-2 text-slate-800">Tạo Tài Khoản Hàng Loạt</h2>
      <p className="text-xs text-slate-500 mb-4">
        Nhập danh sách theo định dạng: <code className="bg-slate-100 p-1 rounded font-bold text-blue-600">username | Họ và Tên | Mã Phòng Ban</code>
      </p>

      {/* Danh sách Mã phòng ban tham khảo */}
      {departments.length > 0 && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border text-xs">
          <span className="font-bold text-slate-700">Mã phòng ban khả dụng: </span>
          <span className="text-slate-600">
            {departments.map(d => `${d.dept_code} (${d.dept_name})`).join(', ')}
          </span>
        </div>
      )}

      <textarea
        rows={8}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={`nv_an | Nguyễn Văn An | ${departments[0]?.dept_code || 'NSDVHC'}\ntran_binh | Trần Thị Bình | ${departments[1]?.dept_code || 'CNTT'}`}
        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      ></textarea>

      <button
        onClick={handleBatchInsert}
        disabled={loading}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow transition-all disabled:opacity-50"
      >
        {loading ? 'Đang xử lý...' : 'Thực Hiện Thêm Hàng Loạt'}
      </button>

      {result && (
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
          <p className="font-bold text-slate-700">Kết quả:</p>
          <p className="text-emerald-600 font-bold">Thành công: {result.insertedCount || 0} tài khoản</p>
          {result.errors?.length > 0 && (
            <div className="text-red-500">
              <p className="font-bold">Lỗi ({result.errors.length}):</p>
              <ul className="list-disc pl-5 space-y-1">
                {result.errors.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}