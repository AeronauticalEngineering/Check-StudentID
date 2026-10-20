// src/lib/certificateGenerator.js
// Client-side dynamic certificate generator using HTML5 Canvas & jsPDF

import { jsPDF } from 'jspdf';

/**
 * Loads an image from URL or dataURL into an HTMLImageElement safely without CORS issues
 */
const loadImage = async (src) => {
  if (!src) throw new Error('No image source provided');

  // 1. Data URLs or Blob URLs do not have CORS issues; load directly
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load data URL image template'));
      img.src = src;
    });
  }

  // 2. For remote URLs (such as Firebase Storage), fetch via server-side proxy
  // This completely eliminates browser CORS restrictions on Canvas
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load proxied image template'));
        img.src = blobUrl;
      });
    }
  } catch (proxyErr) {
    console.warn('Proxy image fetch failed, trying direct image load:', proxyErr);
  }

  // 3. Fallback: Direct image element with crossOrigin
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Last resort: try without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = (err) => reject(new Error('Failed to load image template: ' + (err?.message || 'network or CORS issue')));
      fallbackImg.src = src;
    };
    img.src = src;
  });
};

/**
 * Generates certificate canvas
 * Coordinates calibrated for 1024x730 template:
 * - NAME SURNAME (ENG): Y ~ 385px, font ~32px, bold serif (dark green/black or navy)
 * - PROJECT NAME: Y ~ 468px, font ~22px, bold serif/sans
 * - DATE MONTH YEAR: Y ~ 534px, font ~17px, bold/medium serif
 */
export async function renderCertificateCanvas({
  templateUrl = '',
  fullName = '',
  fullNameEn = '',
  projectName = '',
  dateText = '',
  certificateLayout = null,
  layout = null
}) {
  if (!templateUrl) {
    throw new Error('ไม่พบไฟล์รูปภาพเทมเพลตเกียรติบัตร กรุณาอัปโหลดเทมเพลตในหน้าจัดการกิจกรรม');
  }
  const img = await loadImage(templateUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.width || 1024;
  canvas.height = img.height || 730;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2D context');

  // 1. Draw template image background
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Scaled coordinates relative to baseline 1024x730
  const scaleX = canvas.width / 1024;
  const scaleY = canvas.height / 730;
  const centerX = canvas.width / 2;

  // Active Layout with fallbacks (Name: 385/32, Project: 453/21, Date: 521/16)
  const activeLayout = certificateLayout || layout || {};
  const cfgNameY = activeLayout.nameY !== undefined && activeLayout.nameY !== null ? Number(activeLayout.nameY) : 385;
  const cfgNameFontSize = activeLayout.nameFontSize !== undefined && activeLayout.nameFontSize !== null ? Number(activeLayout.nameFontSize) : 32;
  const cfgProjectY = activeLayout.projectY !== undefined && activeLayout.projectY !== null ? Number(activeLayout.projectY) : 453;
  const cfgProjectFontSize = activeLayout.projectFontSize !== undefined && activeLayout.projectFontSize !== null ? Number(activeLayout.projectFontSize) : 21;
  const cfgDateY = activeLayout.dateY !== undefined && activeLayout.dateY !== null ? Number(activeLayout.dateY) : 521;
  const cfgDateFontSize = activeLayout.dateFontSize !== undefined && activeLayout.dateFontSize !== null ? Number(activeLayout.dateFontSize) : 16;

  // Decide displayName: Prefer uppercase fullNameEn, fallback to fullName
  const rawName = (fullNameEn && fullNameEn.trim()) ? fullNameEn.trim() : (fullName || '').trim();
  const displayName = rawName.toUpperCase();

  // 2. Draw NAME SURNAME
  const nameY = cfgNameY * scaleY;
  const nameFontSize = Math.round(cfgNameFontSize * scaleY);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Use classic elegant serif font matching aviation certificates
  ctx.font = `bold italic ${nameFontSize}px "Times New Roman", Times, Georgia, "Noto Serif", serif`;
  ctx.fillStyle = '#063826'; // Deep hunter green / navy-black
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 1;
  ctx.fillText(displayName, centerX, nameY);
  ctx.restore();

  // 3. Draw PROJECT NAME
  const projY = cfgProjectY * scaleY;
  const projFontSize = Math.round(cfgProjectFontSize * scaleY);
  const displayProject = (projectName && projectName.trim()) ? projectName.trim() : 'WORKSHOP TRAINING PROGRAM';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${projFontSize}px "Times New Roman", Times, Georgia, "Noto Serif", serif`;
  ctx.fillStyle = '#1e293b'; // Slate 800
  ctx.fillText(displayProject, centerX, projY);
  ctx.restore();

  // 4. Draw DATE MONTH YEAR
  const dateY = cfgDateY * scaleY;
  const dateFontSize = Math.round(cfgDateFontSize * scaleY);
  const displayDate = (dateText && dateText.trim()) ? dateText.trim() : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold italic ${dateFontSize}px "Times New Roman", Times, Georgia, "Noto Serif", serif`;
  ctx.fillStyle = '#1e293b';
  ctx.fillText(displayDate, centerX, dateY);
  ctx.restore();

  return canvas;
}

/**
 * Downloads Certificate as PNG (supports Web Share API for LINE/Mobile)
 */
export async function downloadCertificatePNG(options) {
  const canvas = await renderCertificateCanvas(options);
  const cleanName = (options.fullNameEn || options.fullName || 'student').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
  const filename = `Certificate_${cleanName}.png`;

  // 1. Try Web Share API with File (Works directly inside LINE In-App Browser & Mobile)
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      if (blob) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: 'เกียรติบัตรของคุณ (Certificate)'
          });
          return { success: true, method: 'share' };
        }
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
      console.warn('Web Share PNG failed, falling back to anchor download:', shareErr);
    }
  }

  // 2. Standard browser download via <a> tag
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return { success: true, method: 'download' };
}

/**
 * Downloads Certificate as high quality PDF (A4 Landscape, supports Web Share API for LINE/Mobile)
 */
export async function downloadCertificatePDF(options) {
  const canvas = await renderCertificateCanvas(options);
  const cleanName = (options.fullNameEn || options.fullName || 'student').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
  const filename = `Certificate_${cleanName}.pdf`;

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  // 1. Try Web Share API with PDF File (Opens native share sheet to save to Files/Drive in LINE)
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'เกียรติบัตรของคุณ (Certificate PDF)'
        });
        return { success: true, method: 'share' };
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
      console.warn('Web Share PDF failed, falling back to pdf.save:', shareErr);
    }
  }

  // 2. Standard jsPDF save
  pdf.save(filename);
  return { success: true, method: 'download' };
}

/**
 * Generates data URL for instant image preview in modal
 */
export async function getCertificatePreviewDataUrl(options) {
  const canvas = await renderCertificateCanvas(options);
  return canvas.toDataURL('image/png');
}
