import type { SVGProps } from "react";

// Iconos de línea de la interfaz. Heredan el color del texto (currentColor).

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 17, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const ChevronDown = (p: P) => (
  <Svg size={14} strokeWidth={2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const ChevronLeft = (p: P) => (
  <Svg size={16} strokeWidth={2} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const ChevronRight = (p: P) => (
  <Svg size={16} strokeWidth={2} {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const CheckMark = (p: P) => (
  <Svg size={12} strokeWidth={3} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const Dice = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" />
  </Svg>
);

export const Undo = (p: P) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12h-3" />
  </Svg>
);

export const Star = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg fill={filled ? "currentColor" : "none"} {...p}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </Svg>
);

export const Download = (p: P) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M12 4v11" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </Svg>
);

export const Plus = (p: P) => (
  <Svg size={16} strokeWidth={2} {...p}>
    <path d="M5 12h14M12 5v14" />
  </Svg>
);

export const Minus = (p: P) => (
  <Svg size={16} strokeWidth={2} {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const EyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3 4M6.1 6.1C3.9 7.5 2.5 9.6 2 12c1 2.5 5 7 10 7a9.7 9.7 0 004.5-1.1" />
  </Svg>
);

export const Eye = (p: P) => (
  <Svg {...p}>
    <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const Search = (p: P) => (
  <Svg size={15} strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Svg>
);

export const Bookmark = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Svg>
);

export const PagePlus = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M12 10v6M9 13h6" />
  </Svg>
);

export const Close = (p: P) => (
  <Svg size={14} strokeWidth={2.2} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ClearFormat = (p: P) => (
  <Svg size={15} strokeWidth={2} {...p}>
    <path d="M4 7V5h12v2M10 5l-3 14M3 21L21 3" />
  </Svg>
);

export const AlignLeft = (p: P) => (
  <Svg size={15} strokeWidth={2} {...p}>
    <path d="M4 6h16M4 12h10M4 18h14" />
  </Svg>
);

export const AlignCenter = (p: P) => (
  <Svg size={15} strokeWidth={2} {...p}>
    <path d="M4 6h16M7 12h10M5 18h14" />
  </Svg>
);

export const AlignRight = (p: P) => (
  <Svg size={15} strokeWidth={2} {...p}>
    <path d="M4 6h16M10 12h10M6 18h14" />
  </Svg>
);
