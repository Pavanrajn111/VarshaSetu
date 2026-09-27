import { useReducedMotion } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

const AppBackgroundContext = createContext<boolean>(false);

export interface AppBackgroundProps {
  reduceMotion?: boolean;
}

/**
 * AppBackground — Atmospheric Meteorological Mist / Drifting Cloud Layers
 *
 * Replaces the literal rain/storm effect with slow, ambient drifting cloud and
 * mist formations (Option A). Soft radial gradients drift at parallax speeds behind
 * glass panels, evoking Karnataka's sub-seasonal monsoon cloud cover.
 *
 * Respects { reduceMotion }: disables animation and renders static, subtle ambient gradients.
 */
export function AppBackground({ reduceMotion: reduceMotionProp }: AppBackgroundProps = {}) {
  const systemReducedMotion = useReducedMotion() ?? false;
  const reduceMotion = reduceMotionProp !== undefined ? reduceMotionProp : systemReducedMotion;

  const isAlreadyRendered = useContext(AppBackgroundContext);
  if (isAlreadyRendered) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes cloud-drift-primary {
          0% {
            transform: translate3d(-12%, -8%, 0) scale(1);
          }
          50% {
            transform: translate3d(18%, 6%, 0) scale(1.06);
          }
          100% {
            transform: translate3d(-12%, -8%, 0) scale(1);
          }
        }
        @keyframes cloud-drift-secondary {
          0% {
            transform: translate3d(20%, 12%, 0) scale(1.05);
          }
          50% {
            transform: translate3d(-18%, -4%, 0) scale(0.96);
          }
          100% {
            transform: translate3d(20%, 12%, 0) scale(1.05);
          }
        }
        @keyframes cloud-drift-tertiary {
          0% {
            transform: translate3d(-8%, 22%, 0) scale(0.97);
          }
          50% {
            transform: translate3d(14%, 10%, 0) scale(1.04);
          }
          100% {
            transform: translate3d(-8%, 22%, 0) scale(0.97);
          }
        }
      `}</style>

      {/* Layer 1: High-altitude monsoon cloud shelf (slow, broad, soft cyan-teal) */}
      <div
        className="absolute -top-[15%] -left-[10%] h-[650px] w-[950px] rounded-full opacity-[0.16] blur-[95px] will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 45% 45%, color-mix(in oklab, var(--scene-atmosphere, #087eb4) 65%, var(--signal, #38bdf8) 35%) 0%, color-mix(in oklab, var(--signal, #38bdf8) 25%, transparent) 55%, transparent 75%)",
          animation: reduceMotion ? "none" : "cloud-drift-primary 58s ease-in-out infinite",
        }}
      />

      {/* Layer 2: Mid-altitude deep atmospheric moisture mass (parallax counter-drift) */}
      <div
        className="absolute top-[28%] -right-[12%] h-[750px] w-[1050px] rounded-full opacity-[0.13] blur-[110px] will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 55% 50%, color-mix(in oklab, var(--cyan, #06b6d4) 50%, var(--primary, #38bdf8) 50%) 0%, color-mix(in oklab, var(--scene-ocean, #08152f) 30%, transparent) 60%, transparent 80%)",
          animation: reduceMotion ? "none" : "cloud-drift-secondary 74s ease-in-out infinite",
        }}
      />

      {/* Layer 3: Low-altitude ambient mist veil (subtle, wide ground atmosphere) */}
      <div
        className="absolute -bottom-[10%] left-[15%] h-[550px] w-[1100px] rounded-full opacity-[0.11] blur-[100px] will-change-transform"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, color-mix(in oklab, var(--signal, #38bdf8) 40%, transparent) 0%, color-mix(in oklab, var(--card, #0f172a) 40%, transparent) 65%, transparent 85%)",
          animation: reduceMotion ? "none" : "cloud-drift-tertiary 86s ease-in-out infinite",
        }}
      />

      {/* Ambient subtle vignette */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 40%, color-mix(in oklab, var(--scene-ocean, #08152f) 80%, black) 100%)",
        }}
      />
    </div>
  );
}

export function AppBackgroundScope({ children }: { children: ReactNode }) {
  return (
    <AppBackgroundContext.Provider value={true}>
      {children}
    </AppBackgroundContext.Provider>
  );
}
