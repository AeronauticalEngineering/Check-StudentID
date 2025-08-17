'use client';

import StudentHeader from '../../components/StudentHeader';
import { StudentProvider } from '../../context/StudentContext'; // 👈 Import the provider

export default function StudentLayout({ children }) {
  return (
    // 👇 Wrap everything in the StudentProvider
    <StudentProvider>
      <div className="bg-gray-100 min-h-screen font-sans">
        <StudentHeader />
        <main>
          {children}
        </main>
      </div>
    </StudentProvider>
  );
}