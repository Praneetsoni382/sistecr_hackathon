import { memo } from "react";

interface CartoonOfficerAvatarProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export const CartoonOfficerAvatar = memo(function CartoonOfficerAvatar({
  size = 36,
  className = "",
  animated = true,
}: CartoonOfficerAvatarProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full border-2 border-[hsl(var(--sidebar-primary)/.4)] bg-gradient-to-b from-[#e8f3f0] to-[#cbe2dc] shadow-sm transition-transform duration-300 hover:scale-105 ${className}`}
      aria-label="Officer Profile Avatar"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`h-full w-full ${animated ? "officer-avatar-animated" : ""}`}
      >
        <defs>
          {/* Subtle drop shadow for cap and depth */}
          <filter id="capShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodOpacity="0.25" />
          </filter>
          {/* Badge golden gradient */}
          <linearGradient id="badgeGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          {/* Cap fabric gradient */}
          <linearGradient id="capGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#255a50" />
            <stop offset="100%" stopColor="#173e37" />
          </linearGradient>
          {/* Uniform coat gradient */}
          <linearGradient id="coatGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1f4b43" />
            <stop offset="100%" stopColor="#13332d" />
          </linearGradient>
          {/* Visor shine gradient */}
          <linearGradient id="visorShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="35%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes officerBlink {
            0%, 90%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.08); }
          }
          @keyframes badgeShine {
            0%, 80%, 100% { opacity: 0.85; filter: drop-shadow(0 0 0px #fde047); }
            90% { opacity: 1; filter: drop-shadow(0 0 3px #fde047); }
          }
          @keyframes gentleBob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1px); }
          }
          .officer-avatar-animated .officer-eyes {
            transform-origin: 50px 54px;
            animation: officerBlink 4.2s infinite ease-in-out;
          }
          .officer-avatar-animated .officer-badge {
            animation: badgeShine 3.5s infinite ease-in-out;
          }
          .officer-avatar-animated {
            animation: gentleBob 3s infinite ease-in-out;
          }
        `}</style>

        {/* 1. Body & Uniform Coat */}
        <g className="officer-body">
          {/* Shoulders / Uniform Coat */}
          <path
            d="M12 96 C12 80 25 74 38 72 L62 72 C75 74 88 80 88 96 Z"
            fill="url(#coatGreen)"
          />
          {/* Gold Epaulets on shoulders */}
          <rect x="18" y="78" width="10" height="3.5" rx="1.5" fill="#f59e0b" transform="rotate(-15 18 78)" />
          <rect x="72" y="75" width="10" height="3.5" rx="1.5" fill="#f59e0b" transform="rotate(15 72 75)" />

          {/* White Shirt Collar */}
          <polygon points="50,86 42,72 58,72" fill="#ffffff" />
          {/* Tie */}
          <polygon points="50,75 53,80 50,94 47,80" fill="#0f2924" />
          <circle cx="50" cy="76" r="2" fill="#ca8a04" />
        </g>

        {/* 2. Neck & Ears */}
        <rect x="44" y="64" width="12" height="10" rx="2" fill="#fbcfe8" />
        <rect x="44" y="64" width="12" height="10" rx="2" fill="#f5caa6" />
        {/* Left Ear */}
        <circle cx="28" cy="54" r="5.5" fill="#f5caa6" />
        <circle cx="28" cy="54" r="3" fill="#eab086" opacity="0.6" />
        {/* Right Ear */}
        <circle cx="72" cy="54" r="5.5" fill="#f5caa6" />
        <circle cx="72" cy="54" r="3" fill="#eab086" opacity="0.6" />

        {/* 3. Head & Face */}
        <ellipse cx="50" cy="54" rx="23" ry="22" fill="#fed7aa" />
        {/* Hair peeking on sides */}
        <path d="M28 46 C28 42 32 38 34 38 L34 50 Z" fill="#3f2e21" />
        <path d="M72 46 C72 42 68 38 66 38 L66 50 Z" fill="#3f2e21" />

        {/* Rosy Cheeks */}
        <circle cx="36" cy="58" r="3.5" fill="#fb7185" opacity="0.3" />
        <circle cx="64" cy="58" r="3.5" fill="#fb7185" opacity="0.3" />

        {/* Eyebrows */}
        <path d="M36 46 Q41 43 45 46" stroke="#45220d" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M64 46 Q59 43 55 46" stroke="#45220d" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Animated Eyes (Blink) */}
        <g className="officer-eyes">
          {/* Left Eye */}
          <circle cx="41" cy="52" r="3.8" fill="#182e2b" />
          <circle cx="42.2" cy="50.8" r="1.4" fill="#ffffff" />
          <circle cx="39.8" cy="53.4" r="0.7" fill="#ffffff" />

          {/* Right Eye */}
          <circle cx="59" cy="52" r="3.8" fill="#182e2b" />
          <circle cx="60.2" cy="50.8" r="1.4" fill="#ffffff" />
          <circle cx="57.8" cy="53.4" r="0.7" fill="#ffffff" />
        </g>

        {/* Friendly Nose */}
        <path d="M50 53 Q51 56 49.5 57" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" fill="none" />

        {/* Cheerful Smile */}
        <path d="M44 60 Q50 65 56 60" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* 4. Official Peaked Officer Cap */}
        <g filter="url(#capShadow)">
          {/* Cap Crown / Upper Fabric */}
          <path
            d="M24 35 C24 22 35 14 50 14 C65 14 76 22 76 35 C76 38 72 40 50 40 C28 40 24 38 24 35 Z"
            fill="url(#capGreen)"
          />
          {/* Cap Crown Crease highlight */}
          <path
            d="M32 24 C40 18 60 18 68 24"
            stroke="#417c70"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />

          {/* Gold Decorative Chin-Strap Band */}
          <path
            d="M26 36 C34 38 66 38 74 36"
            stroke="#f59e0b"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Band Buttons on side */}
          <circle cx="27" cy="36" r="2.2" fill="#fbbf24" />
          <circle cx="73" cy="36" r="2.2" fill="#fbbf24" />

          {/* Dark Visor / Peak */}
          <path
            d="M28 37 C36 43 64 43 72 37 C75 42 66 46 50 46 C34 46 25 42 28 37 Z"
            fill="url(#visorShine)"
          />
          {/* Visor Specular Reflection */}
          <path
            d="M34 40 C42 43 58 43 66 40"
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />

          {/* Golden Officer Insignia Shield Crest */}
          <g className="officer-badge">
            <path
              d="M50 21 L55 24 L54 30 C54 33 50 35 50 35 C50 35 46 33 46 30 L45 24 Z"
              fill="url(#badgeGold)"
            />
            {/* Tiny Star inside badge */}
            <polygon
              points="50,25 51,27.5 53.5,27.5 51.5,29 52.2,31.5 50,30 47.8,31.5 48.5,29 46.5,27.5 49,27.5"
              fill="#ffffff"
            />
          </g>
        </g>
      </svg>
    </div>
  );
});
