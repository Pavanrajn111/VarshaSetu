import { useReducedMotion } from "motion/react";

export function LandingRainBackground({
  reduceMotion: reduceMotionProp,
}: {
  reduceMotion?: boolean;
} = {}) {
  const systemReducedMotion = useReducedMotion() ?? false;
  const reduceMotion = reduceMotionProp !== undefined ? reduceMotionProp : systemReducedMotion;

  const farDrops = Array.from({ length: reduceMotion ? 6 : 34 }, (_, i) => i);
  const midDrops = Array.from({ length: reduceMotion ? 10 : 48 }, (_, i) => i);
  const nearDrops = Array.from({ length: reduceMotion ? 3 : 16 }, (_, i) => i);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
      <div className="storm-glow" />
      {!reduceMotion && <div className="lightning-flash" />}

      {/* Far rain layer — slow, thin, dim */}
      {farDrops.map((i) => (
        <span
          key={`far-${i}`}
          className="rain-drop-far"
          style={{
            left: `${(i * 53) % 100}%`,
            animationDelay: `${-((i * 0.49) % 4.5)}s`,
            animationDuration: `${3.5 + (i % 5) * 0.2}s`,
            transform: `rotate(${8 + (i % 4)}deg)`,
            height: `${40 + (i % 6) * 3}px`,
          }}
        />
      ))}

      {/* Mid rain layer — default speed and size */}
      {midDrops.map((i) => (
        <span
          key={`mid-${i}`}
          className="rain-drop"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${-((i * 0.37) % 3.8)}s`,
            animationDuration: `${2.0 + (i % 7) * 0.15}s`,
            transform: `rotate(${9 + (i % 5)}deg)`,
            height: `${60 + (i % 8) * 3}px`,
          }}
        />
      ))}

      {/* Near rain layer — fast, thick, slightly blurred */}
      {nearDrops.map((i) => (
        <span
          key={`near-${i}`}
          className="rain-drop-near"
          style={{
            left: `${(i * 67) % 100}%`,
            animationDelay: `${-((i * 0.31) % 1.8)}s`,
            animationDuration: `${1.2 + (i % 4) * 0.16}s`,
            transform: `rotate(${10 + (i % 5)}deg)`,
            height: `${90 + (i % 5) * 7}px`,
          }}
        />
      ))}

      {/* Ground-level mist */}
      {!reduceMotion && <div className="ground-mist" />}
    </div>
  );
}
