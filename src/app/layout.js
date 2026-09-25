// src/app/layout.js - theme & styles
import "./globals.css";
import { ModalProvider } from "../context/ModalContext";

export const metadata = {
  title: "AERO Student Management System",
  description: "ระบบลงทะเบียนและเช็คอินนักเรียน AERO",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="antialiased">
        <ModalProvider>
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}