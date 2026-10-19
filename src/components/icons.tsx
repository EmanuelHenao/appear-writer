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
