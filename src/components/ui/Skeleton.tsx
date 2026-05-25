import { type CSSProperties, type HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Rounded shape — defaults to `md` (matches our Card/Input radius). */
  shape?: 'pill' | 'md' | 'sm' | 'circle';
  /** Optional explicit width/height — useful for inline sized blocks. */
  width?: number | string;
  height?: number | string;
}

const SHAPE_CLASSES = {
  pill:   'rounded-full',
  md:     'rounded-lg',
  sm:     'rounded',
  circle: 'rounded-full aspect-square',
} as const;

/**
 * Single shimmer block. Stack a handful of these to compose any skeleton.
 *
 * The shimmer uses an inline keyframe (no Tailwind plugin needed) so this
 * stays a drop-in primitive — and gives the UI the "loading but alive"
 * feeling that prevents the user from thinking the app froze.
 */
export function Skeleton({
  shape = 'md',
  width,
  height,
  className = '',
  style,
  ...rest
}: SkeletonProps) {
  const composed: CSSProperties = {
    width,
    height,
    background:
      'linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.11) 50%, rgba(0,0,0,0.06) 100%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
    ...style,
  };
  return (
    <>
      <div
        {...rest}
        aria-busy="true"
        aria-live="polite"
        className={[SHAPE_CLASSES[shape], className].join(' ')}
        style={composed}
      />
      {/*
        Inline keyframes — declared once, cheap, and we keep all of the
        skeleton's behaviour in one file.
      */}
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

/** Convenience wrapper for a few stacked text-row skeletons. */
export function SkeletonLines({
  count = 3,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={['flex flex-col gap-2', className].join(' ')}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          shape="sm"
          height={12}
          width={i === count - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}
