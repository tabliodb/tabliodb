interface DotGridProps {
  panX?: number; // Nilai geser horizontal (drag)
  panY?: number; // Nilai geser vertikal (drag)
  zoom?: number; // Skala zoom (contoh: 1, 1.5, 0.5)
}

export function CanvasDotGrid({ panX = 0, panY = 0, zoom = 1 }: DotGridProps) {
  // Ukuran base grid dan titik
  const gridSpacing = 24;
  const dotRadius = 1.5;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none -z-10">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="dot-pattern"
            width={gridSpacing}
            height={gridSpacing}
            patternUnits="userSpaceOnUse"
            // Di sinilah magisnya: Titik akan ikut bergerak dan membesar/mengecil sesuai interaksi user!
            patternTransform={`translate(${panX}, ${panY}) scale(${zoom})`}
          >
            <circle
              cx={dotRadius}
              cy={dotRadius}
              r={dotRadius}
              // Mendukung dark mode langsung dari Tailwind
              className="fill-slate-300 dark:fill-slate-700"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-pattern)" />
      </svg>
    </div>
  );
}
