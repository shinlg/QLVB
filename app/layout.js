import './globals.css';
import SessionManager from '@/components/SessionManager';

export const metadata = {
  title: 'Quản Lý Văn Bản Nội Bộ MARSAMC',
  description: 'Cấp số tự động & lưu trữ file scan văn bản',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        {/* FontAwesome CDN */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {/* Flatpickr CSS */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css"
        />
      </head>
      <body className="bg-slate-100 text-slate-800 min-h-screen py-8 px-4 font-sans">
        <SessionManager />
        {children}
      </body>
    </html>
  );
}