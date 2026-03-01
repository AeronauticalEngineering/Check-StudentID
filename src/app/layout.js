// src/app/layout.js

import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Student Check-in System",
  description: "ระบบลงทะเบียนและเช็คอินนักเรียน",
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
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}