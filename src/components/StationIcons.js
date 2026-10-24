import React from 'react';

export const STATION_ICONS = [
  { id: 'wrench', label: 'ประแจช่าง' },
  { id: 'airplane', label: 'เครื่องบิน' },
  { id: 'pilot-hat', label: 'หมวกนักบิน' },
  { id: 'paper-plane', label: 'เครื่องบินกระดาษ' },
  { id: 'gear', label: 'ฟันเฟือง' },
  { id: 'radar', label: 'เรดาร์' },
  { id: 'compass', label: 'เข็มทิศ' },
  { id: 'rocket', label: 'จรวด' },
  { id: 'satellite', label: 'ดาวเทียม' },
  { id: 'drone', label: 'โดรน' },
  { id: 'certificate', label: 'ประกาศนียบัตร' },
  { id: 'flag', label: 'ธงชัยชนะ' }
];

export function StationSvgIcon({ iconId, className = "w-6 h-6", strokeWidth = 1.8 }) {
  switch (iconId) {
    case 'wrench':
      // Wrench / Spanner: clean, iconic diagonal tool
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );

    case 'airplane':
      // Airplane: clear aerodynamic commercial airliner / jet silhouette
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L12 8L21 14L21 16L12 13L12 19L15 21L15 22L12 21.5L9 22L9 21L12 19L12 13L3 16L3 14L12 8L12 2Z" />
        </svg>
      );

    case 'pilot-hat':
      // Pilot Captain Hat / Peaked Cap with visor, badge, and gold braids
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          {/* Cap Crown / Top */}
          <path d="M4 11C4 7 7.5 4 12 4C16.5 4 20 7 20 11C20 12.5 19.5 13 18 13.5H6C4.5 13 4 12.5 4 11Z" />
          {/* Cap Band */}
          <rect x="5" y="13" width="14" height="3" rx="1" />
          {/* Visor / Brim */}
          <path d="M5 16C5 18.5 8 20 12 20C16 20 19 18.5 19 16" />
          {/* Aviator Wing Badge */}
          <circle cx="12" cy="9.5" r="1.75" />
          <path d="M9.5 9.5H7.5" />
          <path d="M16.5 9.5H14.5" />
        </svg>
      );

    case 'paper-plane':
      // Paper Plane origami
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );

    case 'gear':
      // Mechanical Gear
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );

    case 'radar':
      // Air Traffic Control / Radar sweep screen
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="12" x2="19" y2="5" />
          <circle cx="16" cy="8" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'compass':
      // Navigation Compass
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );

    case 'rocket':
      // Rocket Space Launch
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );

    case 'satellite':
      // Satellite with solar array wings & transmitter dish
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          {/* Main Body Chassis */}
          <rect x="9" y="9" width="6" height="6" rx="1" />
          {/* Left Solar Panel */}
          <rect x="2" y="9.5" width="5" height="5" rx="0.5" />
          <line x1="4.5" y1="9.5" x2="4.5" y2="14.5" />
          <line x1="7" y1="12" x2="9" y2="12" />
          {/* Right Solar Panel */}
          <rect x="17" y="9.5" width="5" height="5" rx="0.5" />
          <line x1="19.5" y1="9.5" x2="19.5" y2="14.5" />
          <line x1="15" y1="12" x2="17" y2="12" />
          {/* Antenna Dish / Transmitter on Top */}
          <path d="M12 9V5" />
          <path d="M9 5C9 3.34 10.34 2 12 2C13.66 2 15 3.34 15 5" />
          <circle cx="12" cy="5" r="0.75" fill="currentColor" />
          {/* Sensor probe bottom */}
          <line x1="12" y1="15" x2="12" y2="18" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      );

    case 'drone':
      // Quadcopter Drone
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" />
          <path d="M9.5 9.5L5 5m9.5 4.5L19 5M9.5 14.5L5 19m9.5-4.5L19 19" />
          <circle cx="4.5" cy="4.5" r="2.5" />
          <circle cx="19.5" cy="4.5" r="2.5" />
          <circle cx="4.5" cy="19.5" r="2.5" />
          <circle cx="19.5" cy="19.5" r="2.5" />
        </svg>
      );

    case 'certificate':
      // Certificate / Badge of achievement
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.5 13.5L17 21L12 18L7 21L8.5 13.5" />
        </svg>
      );

    case 'flag':
    default:
      // Flag / Finish line
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
  }
}

/**
 * Component for rendering Station Stamp Circle on Student's Registration Card
 * - isPassed: true -> Green circle border with bold green checkmark overlay
 * - isPassed: false -> Orange circle border with regular icon
 */
export function StationStampCircle({ iconId, isPassed, size = "md" }) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12 sm:w-14 sm:h-14",
    lg: "w-16 h-16"
  }[size] || "w-12 h-12";

  const iconSizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6 sm:w-7 sm:h-7",
    lg: "w-8 h-8"
  }[size] || "w-6 h-6";

  return (
    <div
      className={`relative rounded-full flex items-center justify-center shrink-0 transition-all ${sizeClasses} ${
        isPassed
          ? "border-2 border-emerald-500 bg-emerald-50/70 text-emerald-600 shadow-xs ring-2 ring-emerald-500/20"
          : "border-2 border-[#ff741f] bg-white text-[#ff741f] shadow-2xs hover:border-[#ff741f]/80"
      }`}
    >
      <StationSvgIcon iconId={iconId} className={iconSizeClasses} strokeWidth={isPassed ? 1.6 : 1.8} />

      {/* Checkmark overlay for completed station (according to design sketch) */}
      {isPassed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-8 h-8 sm:w-9 sm:h-9 text-emerald-600 drop-shadow-xs" fill="none" stroke="currentColor" strokeWidth={2.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}
