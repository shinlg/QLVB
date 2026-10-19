'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import DocumentForm from '@/components/DocumentForm';
import ResultBox from '@/components/ResultBox';
import DocumentHistory from '@/components/DocumentHistory';
import ConfirmModal from '@/components/ConfirmModal';

export default function HomePage() {
  const [departments, setDepartments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // State lưu thông tin user hiện tại từ sessionStorage
  const [currentUser, setCurrentUser] = useState(null);

  // State quản lý Popup xác nhận
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Bổ sung thêm status vào bộ lọc lưu trữ
  const searchFilterRef = useRef({ keyword: '', deptCode: '', status: '' });
  const searchTimeoutRef = useRef(null);
  const resultBoxRef = useRef(null);

  // Lấy thông tin user từ sessionStorage khi load trang
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Lỗi parse user data:', e);
      }
    }
  }, []);

  // Lấy danh sách danh mục (Phòng ban & Loại văn bản)
  const fetchMasterData = async () => {
    try {
      const [deptRes, typeRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/document-types'),
      ]);

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData);
      }
      if (typeRes.ok) {
        const typeData = await typeRes.json();
        setDocumentTypes(typeData);
      }
    } catch (err) {
      console.error('Lỗi fetch danh mục:', err);
    }
  };

  // Lấy lịch sử danh sách tờ trình/văn bản (Đã bổ sung nhận tham số status)
  const fetchHistory = useCallback(async (page = 1, keyword = '', deptCode = '', status = '') => {
    setLoadingDocs(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');

      if (keyword) queryParams.append('q', keyword);
      if (deptCode) queryParams.append('deptCode', deptCode);
      if (status) queryParams.append('status', status); // Truyền tham số lọc trạng thái lên API

      const res = await fetch(`/api/documents?${queryParams.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setDocuments(result.data || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    } catch (err) {
      console.error('Lỗi fetch lịch sử:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
    fetchHistory(1);
  }, [fetchHistory]);

  const handleSearchChange = (keyword, deptCode, status) => {
    searchFilterRef.current = { keyword, deptCode, status };

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchHistory(1, keyword, deptCode, status);
    }, 300);
  };

  const handlePageChange = (newPage) => {
    const { keyword, deptCode, status } = searchFilterRef.current;
    fetchHistory(newPage, keyword, deptCode, status);
  };

  const handleRefresh = () => {
    const { keyword, deptCode, status } = searchFilterRef.current;
    fetchHistory(pagination.page, keyword, deptCode, status);
  };

  // Bước 1: Khi bấm nút "Cấp số" ở Form -> Kiểm tra phân quyền phòng ban trước khi mở Popup
  const handleOpenConfirmModal = (formData) => {
    const userRoles = currentUser?.roles || [];
    const isVTLTorAdmin = userRoles.includes('VTLT') || userRoles.includes('ADMIN');
    const userDeptCode = currentUser?.deptCode;

    if (!userDeptCode && !isVTLTorAdmin) {
      alert('Tài khoản của bạn chưa được gán phòng ban chính. Không thể thực hiện cấp văn bản!');
      return;
    }

    if (!isVTLTorAdmin && formData.deptCode !== userDeptCode) {
      alert(`Bạn chỉ được phép tạo tờ trình/văn bản cho phòng ban của mình (${userDeptCode}). Cần quyền Văn thư Lưu trữ (VTLT) để tạo cho phòng ban khác!`);
      return;
    }

    const selectedDept = departments.find(d => d.code === formData.deptCode);
    const selectedType = documentTypes.find(t => t.code === formData.docType);

    setPendingFormData({
      ...formData,
      deptName: selectedDept ? `${selectedDept.name} (${selectedDept.code})` : formData.deptCode,
      docTypeName: selectedType ? `${selectedType.name} (${selectedType.code})` : formData.docType,
    });
    setIsModalOpen(true);
  };

  // Bước 2: Khi người dùng bấm "Xác nhận cấp số" trong Popup -> Gọi API gửi lên Backend
  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return;
    setIsSubmitting(true);

    try {
      const data = new FormData();
      data.append('docType', pendingFormData.docType);
      data.append('deptCode', pendingFormData.deptCode);
      data.append('subject', pendingFormData.subject);
      data.append('createdBy', pendingFormData.createdBy || '');
      data.append('effectiveDate', pendingFormData.effectiveDate || '');
      data.append('expirationDate', pendingFormData.expirationDate || ''); // Truyền ngày hết hạn
      data.append('isConfidential', pendingFormData.isConfidential ? '1' : '0');
      if (pendingFormData.file) {
        data.append('scanFile', pendingFormData.file);
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: data,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Cấp số thất bại!');
      }

      setResultData(result.data);
      const { keyword, deptCode, status } = searchFilterRef.current;
      fetchHistory(1, keyword, deptCode, status);

      setIsModalOpen(false);
      setPendingFormData(null);

      if (resultBoxRef.current) {
        resultBoxRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Header />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DocumentForm
            departments={departments}
            documentTypes={documentTypes}
            onRequestConfirm={handleOpenConfirmModal}
            resetTrigger={resultData}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div ref={resultBoxRef}>
            <ResultBox resultData={resultData} />
          </div>
          <DocumentHistory
            documents={documents}
            departments={departments}
            documentTypes={documentTypes}
            loading={loadingDocs}
            pagination={pagination}
            onRefresh={handleRefresh}
            onSearchChange={handleSearchChange}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsModalOpen(false);
        }}
        onConfirm={handleConfirmSubmit}
        formData={pendingFormData}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}