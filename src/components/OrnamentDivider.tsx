import { useId } from 'react'

// Thin horizontal divider strip: 22.5°-rotated khatam (8-pointed) stars,
// spaced so adjacent stars touch at exactly two points with no overlap (the
// agreed spacing and rotation). Sized close to ScienceMinor's text-base
// (16px). Named for its role, not its motif, since a motif swap is
// considered likely — the khatam pattern is the only one implemented.
export default function OrnamentDivider() {
  const patternId = useId()

  return (
    <svg width="100%" height="18" aria-hidden="true" className="text-brand-blue">
      <defs>
        <pattern id={patternId} width="14.4" height="18" patternUnits="userSpaceOnUse">
          <g transform="rotate(22.5 7.2 9)" fill="none" stroke="currentColor" strokeWidth="0.6">
            <rect x="1.7" y="3.5" width="11" height="11" />
            <rect x="1.7" y="3.5" width="11" height="11" transform="rotate(45 7.2 9)" />
          </g>
        </pattern>
      </defs>
      {/* Opaque background behind the transparent star strokes — without it,
          whatever sits behind the divider shows through the gaps. Tailwind's
          fill-* utility keeps this on brand tokens, not inline hex, per the
          locked Section 8 convention. */}
      <rect width="100%" height="18" className="fill-brand-ivory" />
      <rect width="100%" height="18" fill={`url(#${patternId})`} />
    </svg>
  )
}
