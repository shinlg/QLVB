import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, formData, isSubmitting }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Xác nhận thông tin cấp số</span>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Nội dung thông tin xem trước */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Vui lòng kiểm tra kỹ các thông tin dưới đây trước khi cấp số chính thức.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-sm">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Loại văn bản:</span>
              <span className="font-semibold text-slate-800">{formData?.docTypeName || formData?.docType}</span>
            </div>

            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Phòng ban tạo:</span>
              <span className="font-semibold text-slate-800">{formData?.deptName || formData?.deptCode}</span>
            </div>

            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Người yêu cầu:</span>
              <span className="font-medium text-slate-700">{formData?.createdBy || 'Vô danh'}</span>
            </div>

            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Ngày hiệu lực:</span>
              <span className="font-medium text-slate-700">{formData?.effectiveDate || 'Hôm nay'}</span>
            </div>

            <div className="flex flex-col border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 mb-1">Trích yếu nội dung:</span>
              <span className="font-medium text-slate-800 bg-white p-2 rounded border border-slate-200 line-clamp-2">
                {formData?.subject}
              </span>
            </div>

            <div className="flex justify-between pt-1">
              <span className="text-slate-500">File đính kèm:</span>
              <span className="font-medium text-blue-600 truncate max-w-[200px]">
                {formData?.file ? formData.file.name : 'Không có file'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200/70 transition-colors disabled:opacity-50"
          >
            Kiểm tra lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Đang cấp số...
              </>
            ) : (
              'Xác nhận cấp số'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}