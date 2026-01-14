"use client";

interface MovementLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function MovementLogo({ className = "", size = "md", showText = true }: MovementLogoProps) {
  const sizes = {
    sm: { icon: "w-8 h-8", text: "text-lg" },
    md: { icon: "w-10 h-10", text: "text-xl" },
    lg: { icon: "w-12 h-12", text: "text-2xl" },
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Movement Logo Icon - Yellow M */}
      <div className={`${sizes[size].icon} rounded-xl bg-movement-yellow flex items-center justify-center shadow-lg shadow-movement-yellow/20`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-6 h-6"
        >
          {/* Stylized M for Movement */}
          <path
            d="M4 18V6L8 12L12 6L16 12L20 6V18"
            stroke="black"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className={`${sizes[size].text} font-bold text-white font-display tracking-tight`}>
            MOVEMENT
          </span>
        </div>
      )}
    </div>
  );
}

// Alternative: Full Movement wordmark logo
export function MovementWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-movement-yellow flex items-center justify-center">
        <span className="text-black font-bold text-lg font-display">M</span>
      </div>
      <span className="text-xl font-bold text-white font-display tracking-tight">
        MOVEMENT
      </span>
    </div>
  );
}
