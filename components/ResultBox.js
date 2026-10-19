'use client';

export default function ResultBox({ resultData }) {
  if (!resultData) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultData.document_number).then(() => {
      alert('Đã copy số tờ trình: ' + resultData.document_number);
    });
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Cấp Số Thành Công!
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-3xl font-extrabold text-emerald-700 font-mono">
              {resultData.document_number}
            </span>
            <button
              onClick={copyToClipboard}
              className="text-xs bg-emerald-200 hover:bg-emerald-300 text-emerald-800 px-2.5 py-1 rounded border border-emerald-300 flex items-center gap-1 transition-colors"
            >
              <i className="fa-regular fa-copy"></i> Copy
            </button>
          </div>
          <p className="text-sm text-emerald-900 mt-2 font-medium">
            Trích yếu: {resultData.subject}
          </p>
        </div>
      </div>
    </div>
  );
}