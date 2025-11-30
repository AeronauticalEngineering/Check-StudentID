import AdminNavbar from '../../components/AdminNavbar';

export default function AdminLayout({ children }) {
  return (
    <div>
      <AdminNavbar />
      <main>
        {children}
      </main>
    </div>
  );
}