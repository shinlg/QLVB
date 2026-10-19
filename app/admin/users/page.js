'use client';

import { useState, useEffect } from 'react';

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState('NONE');

  // State Danh sách phòng ban & Danh sách Role hệ thống
  const [departments, setDepartments] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // State Form Thêm Người Dùng
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDefaultPassword, setNewDefaultPassword] = useState('123456');
  const [selectedRoles, setSelectedRoles] = useState(['USER']);
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState({ type: '', text: '' });

  // State Danh sách Người Dùng
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // State Modal Sửa thông tin (Phòng ban & Roles) cho từng User cụ thể
  const [editingUser, setEditingUser] = useState(null);
  const [tempUserRoles, setTempUserRoles] = useState([]);
  const [tempDeptCode, setTempDeptCode] = useState('');

  // 1. Lấy danh sách phòng ban và danh sách roles động từ API khi load trang
  useEffect(() => {
    setLoadingDepts(true);
    Promise.all([
      fetch('/api/departments').then(res => res.json()).catch(() => []),
      fetch('/api/roles').then(res => res.json()).catch(() => [])
    ])
      .then(([deptData, roleData]) => {
        const listDept = Array.isArray(deptData) ? deptData : [];
        setDepartments(listDept);
        if (listDept.length > 0) {
          setNewDeptCode(listDept[0].dept_code || listDept[0].code || '');
        }

        const listRole = Array.isArray(roleData) ? roleData : [];
        setAllRoles(listRole);
      })
      .finally(() => setLoadingDepts(false));
  }, []);

  // Lấy danh sách người dùng
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách người dùng:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LIST_USERS') {
      fetchUsers();
    }
  }, [activeTab]);

  // Xử lý thay đổi checkbox Roles (Dùng chung cho tạo mới và sửa modal)
  const handleRoleToggle = (roleCode, isEditMode = false) => {
    if (isEditMode) {
      setTempUserRoles(prev => 
        prev.includes(roleCode) ? prev.filter(r => r !== roleCode) : [...prev, roleCode]
      );
    } else {
      setSelectedRoles(prev => 
        prev.includes(roleCode) ? prev.filter(r => r !== roleCode) : [...prev, roleCode]
      );
    }
  };

  // Xử lý tạo tài khoản mới gửi kèm mảng roles
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateMsg({ type: '', text: '' });

    if (!newDeptCode) {
      setCreateMsg({ type: 'error', text: 'Vui lòng chọn phòng ban!' });
      return;
    }

    if (selectedRoles.length === 0) {
      setCreateMsg({ type: 'error', text: 'Vui lòng chọn ít nhất một vai trò (role)!' });
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          username: newUsername,
          full_name: newFullName,
          primary_dept_code: newDeptCode,
          default_password: newDefaultPassword,
          roles: selectedRoles,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreateMsg({ type: 'success', text: data.message || 'Tạo tài khoản thành công!' });
        setNewUsername('');
        setNewFullName('');
        setNewDefaultPassword('123456');
        setSelectedRoles(['USER']);
      } else {
        setCreateMsg({ type: 'error', text: data.error || 'Thêm thất bại!' });
      }
    } catch (err) {
      setCreateMsg({ type: 'error', text: 'Lỗi kết nối Server!' });
    } finally {
      setCreateLoading(false);
    }
  };

  // Lưu cập nhật Phòng ban & Roles cho user được chọn
  const handleSaveUserRoles = async () => {
    if (!editingUser) return;
    setActionLoading(editingUser.id);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ROLES',
          userId: editingUser.id,
          primary_dept_code: tempDeptCode,
          roles: tempUserRoles,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Cập nhật thông tin thành công!');
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || 'Cập nhật thất bại!');
      }
    } catch (err) {
      alert('Lỗi kết nối Server!');
    } finally {
      setActionLoading(null);
    }
  };

  // Thao tác quản trị khác
  const handleUserAction = async (action, userId, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;

    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Thao tác thành công!');
        fetchUsers();
      } else {
        alert(data.error || 'Thao tác thất bại!');
      }
    } catch (err) {
      alert('Lỗi kết nối Server!');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.primary_dept_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f0f4f9] p-4 md:p-8 font-sans">
      
      {/* THANH MENU QUẢN TRỊ */}
      <div className="max-w-6xl mx-auto bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 text-blue-700 text-xs font-black tracking-wider px-3 py-1.5 rounded-lg uppercase">
            ADMIN CENTER
          </span>
          <h1 className="text-xl font-extrabold text-slate-800">Quản Lý Hệ Thống</h1>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-sm">
          <button
            onClick={() => setActiveTab(activeTab === 'ADD_USER' ? 'NONE' : 'ADD_USER')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'ADD_USER' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            ➕ Thêm Người Dùng
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'LIST_USERS' ? 'NONE' : 'LIST_USERS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'LIST_USERS' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            📋 Quản Lý Người Dùng
          </button>

          <span className="h-5 w-[1px] bg-slate-200 mx-1 hidden md:block"></span>

          <button onClick={() => (window.location.href = '/')} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer">
            📄 Cấp Văn Bản
          </button>
          <button onClick={() => (window.location.href = '/search')} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer">
            🔍 Tra Cứu
          </button>
          <button onClick={() => (window.location.href = '/login')} className="px-3.5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-medium cursor-pointer ml-1">
            🚪 Đăng Xuất
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">

        {activeTab === 'NONE' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">🛠️</div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">Trung Tâm Quản Trị Người Dùng</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Vui lòng chọn <strong className="text-blue-600">"➕ Thêm Người Dùng"</strong> hoặc <strong className="text-slate-700">"📋 Danh Sách Người Dùng"</strong> từ thanh menu ở trên.
            </p>
          </div>
        )}

        {/* 2. FORM THÊM NGƯỜI DÙNG KÈM DYNAMIC ROLES */}
        {activeTab === 'ADD_USER' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 max-w-2xl mx-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2.5 text-blue-600 font-bold text-xl">
                ➕ Thêm Người Dùng Mới
              </div>
              <button onClick={() => setActiveTab('NONE')} className="text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer">
                ✕ Đóng
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-5">
              {createMsg.text && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold ${createMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {createMsg.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">TÊN ĐĂNG NHẬP (USERNAME)</label>
                <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Ví dụ: nv_an" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">HỌ VÀ TÊN</label>
                <input type="text" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn An" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">PHÒNG BAN CHÍNH</label>
                <select value={newDeptCode} onChange={(e) => setNewDeptCode(e.target.value)} disabled={loadingDepts} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer">
                  {loadingDepts ? <option value="">Đang tải phòng ban...</option> : departments.map((dept) => {
                    const code = dept.dept_code || dept.code;
                    const name = dept.dept_name || dept.name;
                    return <option key={code} value={code}>{name} ({code})</option>;
                  })}
                </select>
              </div>

              {/* RENDER DYNAMIC ROLES CHECKBOXES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">PHÂN QUYỀN VAI TRÒ (CHỌN MỘT HOẶC NHIỀU)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {allRoles.map((role) => (
                    <label key={role.role_code} className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.role_code)}
                        onChange={() => handleRoleToggle(role.role_code, false)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300"
                      />
                      <span className="text-xs font-semibold text-slate-700">{role.role_name} <span className="text-slate-400">({role.role_code})</span></span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">MẬT KHẨU MẶC ĐỊNH</label>
                <input type="text" required value={newDefaultPassword} onChange={(e) => setNewDefaultPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none" />
              </div>

              <button type="submit" disabled={createLoading} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50">
                {createLoading ? 'Đang tạo...' : 'Tạo Tài Khoản'}
              </button>
            </form>
          </div>
        )}

        {/* 3. BẢNG DANH SÁCH NGƯỜI DÙNG KÈM NÚT SỬA ROLES & PHÒNG BAN */}
        {activeTab === 'LIST_USERS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">📋 Danh Sách Người Dùng</h2>
                <p className="text-xs text-slate-500">Quản lý trạng thái, reset mật khẩu, khóa tài khoản và phân quyền vai trò</p>
              </div>

              <div className="flex items-center gap-3">
                <input type="text" placeholder="Tìm username, họ tên..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full md:w-64 outline-none" />
                <button onClick={() => setActiveTab('NONE')} className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer">✕ Đóng</button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-xs font-bold uppercase border-b border-slate-200">
                    <th className="p-3.5">Username</th>
                    <th className="p-3.5">Họ và tên</th>
                    <th className="p-3.5">Phòng Ban</th>
                    <th className="p-3.5">Vai Trò (Roles)</th>
                    <th className="p-3.5">Trạng thái</th>
                    <th className="p-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center p-8 text-slate-400">Đang tải dữ liệu...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan="6" className="text-center p-8 text-slate-400">Không tìm thấy tài khoản.</td></tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isLocked = user.status === 'LOCKED_FAILED_ATTEMPTS' || user.failed_login_count >= 5;
                      const isDisabled = user.status === 'DISABLED';
                      const userRoles = Array.isArray(user.roles) ? user.roles : ['USER'];

                      return (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-800">{user.username}</td>
                          <td className="p-3.5 text-slate-700">{user.full_name || '---'}</td>
                          <td className="p-3.5 text-slate-600 font-mono text-xs font-bold">{user.primary_dept_code || '---'}</td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {userRoles.map((roleCode) => (
                                <span key={roleCode} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-bold">
                                  {roleCode}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5">
                            {isLocked ? <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Bị khóa</span> :
                             isDisabled ? <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Vô hiệu hóa</span> :
                             <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Hoạt động</span>}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* NÚT MỞ MODAL SỬA PHÒNG BAN & ROLES */}
                              <button
                                onClick={() => { 
                                  setEditingUser(user); 
                                  setTempUserRoles([...userRoles]); 
                                  setTempDeptCode(user.primary_dept_code || ''); 
                                }}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Sửa Quyền/Phòng Ban
                              </button>

                              {isLocked && (
                                <button disabled={actionLoading === user.id} onClick={() => handleUserAction('UNLOCK', user.id, `Mở khóa ${user.username}?`)} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer">Mở khóa</button>
                              )}

                              <button disabled={actionLoading === user.id} onClick={() => handleUserAction('RESET_PASSWORD', user.id, `Reset MK ${user.username}?`)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold cursor-pointer">Reset MK</button>

                              {isDisabled ? (
                                <button disabled={actionLoading === user.id} onClick={() => handleUserAction('ENABLE', user.id)} className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold cursor-pointer">Kích hoạt</button>
                              ) : (
                                <button disabled={actionLoading === user.id} onClick={() => handleUserAction('DISABLE', user.id, `Khóa ${user.username}?`)} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold cursor-pointer">Khóa</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MODAL SỬA PHÒNG BAN & ROLES CHO TỪNG USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-800">Chỉnh Sửa Cho: <span className="text-blue-600">{editingUser.username}</span></h3>
            
            {/* Chọn phòng ban chính */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phòng Ban Chính</label>
              <select
                value={tempDeptCode}
                onChange={(e) => setTempDeptCode(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer"
              >
                {departments.map((dept) => {
                  const code = dept.dept_code || dept.code;
                  const name = dept.dept_name || dept.name;
                  return (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Chọn vai trò (Roles) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phân Quyền Vai Trò</label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                {allRoles.map((role) => (
                  <label key={role.role_code} className="flex items-center space-x-2 cursor-pointer p-1">
                    <input
                      type="checkbox"
                      checked={tempUserRoles.includes(role.role_code)}
                      onChange={() => handleRoleToggle(role.role_code, true)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-xs font-semibold text-slate-700">{role.role_name} ({role.role_code})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer">Hủy</button>
              <button onClick={handleSaveUserRoles} disabled={actionLoading === editingUser.id} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer disabled:opacity-50">Lưu Thay Đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}