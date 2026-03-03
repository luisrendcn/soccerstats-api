import { ReactNode } from 'react';

interface TeamColorProps {
  color: string;
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/**
 * Wrapper component for displaying team colors dynamically
 * Using CSS custom properties instead of inline styles
 */
export function TeamColorBadge({ color, className = '', ...props }: TeamColorProps) {
  return (
    <div
      className={`w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ '--team-color': color } as React.CSSProperties}
      data-team-color
      {...props}
    />
  );
}

export function TeamColorCircle({ color, className = '', ...props }: TeamColorProps) {
  return (
    <div
      className={`w-10 h-10 rounded-full mb-4 shadow-sm ${className}`}
      style={{ '--team-color': color } as React.CSSProperties}
      data-team-color
      {...props}
    />
  );
}

export function TeamColorCircleLarge({ color, className = '', children, ...props }: TeamColorProps) {
  return (
    <div
      className={`w-16 h-16 rounded-full shadow-md flex items-center justify-center text-2xl font-bold text-white ${className}`}
      style={{ '--team-color': color } as React.CSSProperties}
      data-team-color
      {...props}
    >
      {children}
    </div>
  );
}

export function TeamColorCircleSmall({ color, className = '', ...props }: TeamColorProps) {
  return (
    <div
      className={`w-8 h-8 rounded-full shadow-sm border-2 ${className}`}
      style={{ '--team-color': color } as React.CSSProperties}
      data-team-color
      {...props}
    />
  );
}

export function TeamColorGradientBackground({ color, className = '', ...props }: TeamColorProps) {
  return (
    <div
      className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-black/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 ${className}`}
      style={{ '--team-color-light': `${color}10` } as React.CSSProperties}
      data-team-color-light
      {...props}
    />
  );
}
