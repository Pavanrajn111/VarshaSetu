import {
  Activity,
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CloudRain,
  Database,
  Droplets,
  Gauge,
  Globe2,
  Languages,
  Map,
  MessageCircleMore,
  Mic2,
  Radar,
  Satellite,
  ShieldCheck,
  Sprout,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { ForecastDashboard } from "@/components/ForecastDashboard";

const ClimateGlobe = lazy(() =>
  import("@/components/ClimateGlobe").then((module) => ({ default: module.ClimateGlobe })),
);

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const fadeLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0 },
};

const fadeRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1 },
};

const blurIn = {
  hidden: { opacity: 0, filter: "blur(8px)" },
  visible: { opacity: 1, filter: "blur(0px)" },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function SectionHeading({
  index,
  eyebrow,
  title,
  description,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      className="mb-12 grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-end"
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <motion.div variants={fadeUp} transition={{ type: "spring", stiffness: 80, damping: 18 }}>
        <div className="mb-4 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-signal">
          <span>{index}</span>
          <span className="h-px w-12 bg-signal/60" />
          {eyebrow}
        </div>
        <h2 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          {title}
        </h2>
      </motion.div>
      <motion.p
        variants={blurIn}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end lg:text-lg"
      >
        {description}
      </motion.p>
    </motion.div>
  );
}

const featureCards: Array<{
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  accent: string;
}> = [
  {
    icon: Map,
    label: "01 / Spatial",
    title: "Hyperlocal Risk Map",
    body: "Block and panchayat-level rainfall risk, translated into field-ready decisions.",
    accent: "text-signal",
  },
  {
    icon: Radar,
    label: "02 / Forecast",
    title: "Multi-Source Ensemble",
    body: "Independent global models are weighted against regional weather behaviour.",
    accent: "text-cyan",
  },
  {
    icon: Droplets,
    label: "03 / Water",
    title: "Crop-Specific Irrigation",
    body: "FAO-56 water demand aligned with crop stage, soil, and forecast rainfall.",
    accent: "text-warning",
  },
  {
    icon: Languages,
    label: "04 / Access",
    title: "Bilingual Voice & Text",
    body: "Actionable English and Kannada advisories built for low-friction access.",
    accent: "text-cyan",
  },
  {
    icon: BarChart3,
    label: "05 / Context",
    title: "Historical Climatology",
    body: "Twenty-four years of climate history reveal anomalies and local baselines.",
    accent: "text-success",
  },
  {
    icon: Gauge,
    label: "06 / Operations",
    title: "Officer Command Center",
    body: "District-wide risk monitoring, advisories, and transparent model confidence.",
    accent: "text-warning",
  },
];

function TiltCard({ item, index }: { item: (typeof featureCards)[number]; index: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 180, damping: 22 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { stiffness: 180, damping: 22 });
  const Icon = item.icon;

  return (
    <motion.article
      className="feature-card group relative overflow-hidden border border-border/70 bg-glass p-6 backdrop-blur-xl"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left) / rect.width - 0.5);
        y.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      variants={scaleIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 80, damping: 18, delay: index * 0.07 }}
    >
      <div className="mb-12 flex items-start justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {item.label}
        </span>
        <Icon className={`size-6 ${item.accent}`} aria-hidden="true" />
      </div>
      <h3 className="mb-3 font-display text-2xl font-medium text-foreground">{item.title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
      <div className="mt-6 h-px w-full bg-border/60">
        <div className="h-px w-12 bg-signal transition-all duration-500 group-hover:w-3/4" />
      </div>
    </motion.article>
  );
}

function AnimatedMetric({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.65 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const duration = 1300;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reduceMotion, value]);

  return (
    <div ref={ref} className="border-l border-border pl-5">
      <div className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
        {display}
        {suffix}
      </div>
      <div className="mt-3 max-w-40 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

const workflow = [
  {
    icon: Database,
    title: "Ingest",
    tag: "NOAA · DWD · ECMWF",
    copy: "Atmosphere, ocean indices, and multi-model rainfall signals.",
  },
  {
    icon: Bot,
    title: "Predict",
    tag: "ML ensemble",
    copy: "Bias-corrected probability, onset, and dry-spell forecasts.",
  },
  {
    icon: Waves,
    title: "Synthesize",
    tag: "Penman–Monteith",
    copy: "Crop water demand fused with soil and growth-stage context.",
  },
  {
    icon: Languages,
    title: "Advise",
    tag: "English · ಕನ್ನಡ",
    copy: "Clear actions, not charts: sow, irrigate, wait, or protect.",
  },
  {
    icon: MessageCircleMore,
    title: "Deliver",
    tag: "WhatsApp · Voice",
    copy: "Last-mile alerts designed around how farmers already communicate.",
  },
];

export function VarshaSetuLanding() {
  return (
    <main className="relative overflow-clip bg-background text-foreground">
      <AppHeader showProgress={true}>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border/80 bg-glass/80 backdrop-blur-lg h-8 text-xs"
          >
            <a href="#impact">Impact</a>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-medium h-8 text-xs"
          >
            <Link to="/dashboard">
              Live Studio <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </AppHeader>

      <section id="top" className="relative z-10 min-h-[100svh] border-b border-border/60">
        <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center px-5 pb-20 pt-28 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="relative z-10"
          >
            <motion.div
              variants={fadeUp}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
            >
              <Badge
                variant="outline"
                className="mb-7 gap-2 border-signal/30 bg-signal/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-signal"
              >
                <Zap className="size-3" /> SIH 2026 · PS 26086 · Team Nexus
              </Badge>
            </motion.div>
            <motion.p
              variants={blurIn}
              transition={{ duration: 0.7 }}
              className="mb-3 font-kannada text-base text-cyan"
            >
              ಮಳೆಯ ಮುನ್ಸೂಚನೆ. ರೈತರ ನಿರ್ಧಾರ.
            </motion.p>
            <motion.h1
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
              className="max-w-3xl font-display text-[clamp(4.2rem,11vw,8.8rem)] font-semibold leading-[0.78] text-foreground"
            >
              {"Varsha".split("").map((char, i) => (
                <motion.span
                  key={`v-${i}`}
                  variants={fadeUp}
                  transition={{ type: "spring", stiffness: 100, damping: 16 }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
              <br />
              <span className="text-signal">
                {"Setu.".split("").map((char, i) => (
                  <motion.span
                    key={`s-${i}`}
                    variants={fadeUp}
                    transition={{
                      type: "spring",
                      stiffness: 100,
                      damping: 16,
                      delay: 0.36 + i * 0.06,
                    }}
                    className="inline-block"
                  >
                    {char}
                  </motion.span>
                ))}
              </span>
            </motion.h1>
            <motion.p
              variants={blurIn}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl"
            >
              AI-powered hyperlocal monsoon intelligence that turns global climate signals into
              field-level decisions for Karnataka farmers.
            </motion.p>
            <motion.div
              variants={fadeUp}
              transition={{ type: "spring", stiffness: 70, damping: 16 }}
              className="mt-9 flex flex-wrap gap-3"
            >
              <Button
                asChild
                size="lg"
                className="h-12 bg-signal px-6 text-signal-foreground shadow-signal hover:bg-signal/90"
              >
                <a href="/dashboard">
                  Launch Prediction Studio <ArrowRight />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-border bg-glass/60 px-6 backdrop-blur-lg hover:bg-glass"
              >
                <a href="#features">
                  Explore Features <ArrowDown />
                </a>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative mt-10 h-[45vh] min-h-96 lg:mt-0 lg:h-[72vh]"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.2 }}
          >
            <div className="absolute inset-0 globe-halo" />
            <Suspense
              fallback={<div className="h-full w-full animate-pulse rounded-full bg-glass" />}
            >
              <ClimateGlobe reduceMotion={reduceMotion} />
            </Suspense>
            <div className="absolute bottom-6 left-0 border-l border-signal bg-glass/70 px-4 py-3 backdrop-blur-xl lg:left-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Focus region
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                <span className="size-1.5 rounded-full bg-warning" /> Karnataka · 14.5°N
              </div>
            </div>
          </motion.div>

          <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground lg:flex">
            <span className="h-8 w-px bg-border">
              <span className="block h-1/2 w-px animate-scroll-line bg-signal" />
            </span>{" "}
            Scroll to trace the signal
          </div>
        </div>
      </section>

      <section className="section-band relative z-10 border-b border-border/60 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHeading
            index="01"
            eyebrow="The problem"
            title="A district forecast cannot decide a field."
            description="Rainfall can shift across a few kilometres. Yet planting, irrigation, and crop protection decisions are still made from broad forecasts that hide local risk."
          />
          <div className="grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-[0.92fr_1.08fr]">
            <motion.div
              className="bg-surface p-7 sm:p-10"
              variants={fadeLeft}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 60, damping: 18 }}
            >
              <div className="mb-9 flex items-center gap-3 text-warning">
                <CloudRain className="size-7" />
                <span className="font-mono text-xs uppercase tracking-[0.16em]">Forecast gap</span>
              </div>
              <motion.div
                className="space-y-7"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
              >
                {[
                  [
                    "01",
                    "Coarse signals",
                    "District averages flatten convective rain and local dry spells.",
                  ],
                  [
                    "02",
                    "High-stakes timing",
                    "A missed onset window can turn seed, labour, and input costs into losses.",
                  ],
                  [
                    "03",
                    "Last-mile friction",
                    "Charts and technical forecasts rarely become a timely farm action.",
                  ],
                ].map(([id, title, copy]) => (
                  <motion.div
                    key={id}
                    className="problem-item grid grid-cols-[2.5rem_1fr] gap-3 border-t border-border pt-5"
                    variants={fadeUp}
                    transition={{ type: "spring", stiffness: 80, damping: 18 }}
                  >
                    <span className="font-mono text-xs text-signal">{id}</span>
                    <div>
                      <h3 className="font-display text-xl">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              className="karnataka-map relative min-h-[28rem] overflow-hidden bg-panel p-6"
              variants={fadeRight}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 60, damping: 18 }}
            >
              <div className="absolute left-6 top-6 z-10">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Spatial resolution
                </span>
                <div className="mt-2 text-lg font-medium">District → Block → Panchayat</div>
              </div>
              <svg
                viewBox="0 0 500 500"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label="Stylized Karnataka hyperlocal risk grid"
              >
                <defs>
                  <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" className="map-grid" fill="none" />
                  </pattern>
                </defs>
                <rect width="500" height="500" fill="url(#grid)" opacity="0.45" />
                <path
                  className="karnataka-shape"
                  d="M214 49l65 20 25 54 45 33-8 61 35 47-33 52-18 88-58 55-54-34-13-63-44-57 25-64-22-68 32-53z"
                />
                {[
                  [254, 120],
                  [292, 171],
                  [226, 210],
                  [304, 262],
                  [247, 302],
                  [285, 352],
                  [234, 386],
                ].map(([cx, cy], i) => (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={i === 3 ? 12 : 6}
                    className={i === 3 ? "map-node-hot" : "map-node"}
                  />
                ))}
                <path
                  d="M254 120L292 171L226 210L304 262L247 302L285 352L234 386"
                  className="map-path"
                />
              </svg>
              <div className="absolute bottom-6 right-6 flex items-center gap-2 border border-warning/30 bg-warning/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-warning backdrop-blur-lg">
                <Activity className="size-4" /> Local anomaly detected
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="workflow" className="relative z-10 border-b border-border/60 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHeading
            index="02"
            eyebrow="How it works"
            title="From global signal to local action."
            description="Varsha Setu builds one traceable decision chain—collecting trusted data, resolving uncertainty, calculating crop water need, and delivering the answer in familiar channels."
          />
          <motion.div
            className="relative grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.article
                  key={step.title}
                  className="workflow-card relative min-h-72 bg-surface p-6"
                  variants={fadeUp}
                  transition={{ type: "spring", stiffness: 70, damping: 16, delay: index * 0.1 }}
                >
                  <div className="mb-10 flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                    <Icon className="size-6 text-signal" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
                    {step.tag}
                  </div>
                  <h3 className="mt-3 font-display text-2xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.copy}</p>
                  {index < workflow.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-6 rounded-full border border-border bg-panel p-1 text-signal lg:block" />
                  )}
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section
        id="features"
        className="section-band relative z-10 border-b border-border/60 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHeading
            index="03"
            eyebrow="Platform"
            title="Intelligence built for the monsoon edge."
            description="Every layer is designed to reduce uncertainty without adding complexity for the farmer or the field officer."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((item, index) => (
              <TiltCard item={item} index={index} key={item.title} />
            ))}
          </div>
        </div>
      </section>

      <section
        id="dashboard"
        className="relative z-10 border-b border-border/60 bg-slate-950/90 py-16 sm:py-24"
      >
        <ForecastDashboard />
      </section>

      <section className="relative z-10 border-b border-border/60 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHeading
            index="04"
            eyebrow="The science"
            title="Credibility you can inspect."
            description="Recommendations are only as strong as their evidence. Varsha Setu preserves the source, confidence, and benchmark behind every advisory."
          />
          <motion.div
            className="grid gap-px border border-border bg-border md:grid-cols-3 lg:grid-cols-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {["NOAA", "DWD", "ECMWF", "BoM", "FAO-56", "IMD"].map((source) => (
              <motion.div
                key={source}
                variants={fadeUp}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
                className="science-badge bg-surface px-5 py-8 text-center font-display text-xl text-muted-foreground transition-colors hover:text-signal"
              >
                {source}
              </motion.div>
            ))}
          </motion.div>
          <motion.div
            className="audit-banner mt-6 flex flex-col gap-5 border border-success/30 bg-success/5 p-6 sm:flex-row sm:items-center sm:justify-between"
            variants={blurIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 size-7 shrink-0 text-success" />
              <div>
                <div className="font-display text-xl">Transparent by design</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Model outputs are benchmarked against observations, with confidence bands and
                  source lineage visible to officers.
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Our current model benchmarks closely against historical climatology (58.17mm vs.
                  57.76mm MAE on held-out data) — which is why predictions combine live multi-agency
                  forecasts with historical baselines, rather than relying on the ML model alone.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-success/40 bg-success/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-success"
            >
              Benchmarking enabled
            </Badge>
          </motion.div>
        </div>
      </section>

      <section id="impact" className="relative z-10 overflow-hidden bg-panel py-24 sm:py-32">
        <div className="impact-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHeading
            index="05"
            eyebrow="Projected impact"
            title="Better timing. Stronger seasons."
            description="The platform is designed around measurable outcomes—from fewer false sowing decisions to more revenue protected across Karnataka."
          />
          <motion.div
            className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <motion.div
              className="impact-metric"
              variants={fadeLeft}
              transition={{ type: "spring", stiffness: 70, damping: 18 }}
            >
              <AnimatedMetric value={30} suffix="%" label="False-sowing reduction, up to" />
            </motion.div>
            <motion.div
              className="impact-metric"
              variants={fadeLeft}
              transition={{ type: "spring", stiffness: 70, damping: 18 }}
            >
              <AnimatedMetric value={25} suffix="%" label="Revenue protected, up to" />
            </motion.div>
            <motion.div
              className="impact-metric"
              variants={fadeLeft}
              transition={{ type: "spring", stiffness: 70, damping: 18 }}
            >
              <AnimatedMetric value={18} label="Districts covered, statewide rollout in progress" />
            </motion.div>
            <motion.div
              className="impact-metric"
              variants={fadeLeft}
              transition={{ type: "spring", stiffness: 70, damping: 18 }}
            >
              <AnimatedMetric value={3} label="Met agencies fused" />
            </motion.div>
            <motion.div
              className="impact-metric"
              variants={fadeLeft}
              transition={{ type: "spring", stiffness: 70, damping: 18 }}
            >
              <AnimatedMetric value={24} suffix=" yrs" label="Climate data" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 min-h-[78svh] overflow-hidden border-t border-border/60 bg-background py-24 sm:py-32">
        <div className="closing-rings absolute inset-0" aria-hidden="true" />
        <motion.div
          className="relative mx-auto flex max-w-5xl flex-col items-center px-5 text-center sm:px-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div variants={fadeUp} transition={{ type: "spring", stiffness: 80, damping: 18 }}>
            <Badge
              variant="outline"
              className="mb-8 gap-2 border-signal/30 bg-signal/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-signal"
            >
              <Satellite className="size-3" /> Smart India Hackathon 2026
            </Badge>
          </motion.div>
          <motion.p
            variants={blurIn}
            transition={{ duration: 0.6 }}
            className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground"
          >
            Team Nexus presents
          </motion.p>
          <motion.h2
            variants={scaleIn}
            transition={{ type: "spring", stiffness: 60, damping: 16 }}
            className="mt-5 font-display text-5xl font-semibold leading-[0.95] sm:text-7xl lg:text-8xl"
          >
            Bridge the forecast.
            <br />
            <span className="text-signal">Protect the harvest.</span>
          </motion.h2>
          <motion.p
            variants={blurIn}
            transition={{ duration: 0.8 }}
            className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground"
          >
            A decision bridge between the world's climate intelligence and the farmer standing in
            the field.
          </motion.p>
          <motion.div variants={fadeUp} transition={{ type: "spring", stiffness: 70, damping: 16 }}>
            <Button
              asChild
              size="lg"
              className="mt-10 h-13 bg-signal px-8 text-signal-foreground shadow-signal hover:bg-signal/90"
            >
              <a href="#top">
                Bridge the Forecast <ArrowRight />
              </a>
            </Button>
          </motion.div>
          <motion.div
            variants={staggerContainer}
            className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            <motion.span
              variants={fadeUp}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
              className="flex items-center gap-2"
            >
              <Sprout className="size-4 text-success" /> Built for Karnataka
            </motion.span>
            <motion.span
              variants={fadeUp}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
              className="flex items-center gap-2"
            >
              <Globe2 className="size-4 text-cyan" /> Global data · Local decisions
            </motion.span>
            <motion.span
              variants={fadeUp}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
              className="flex items-center gap-2"
            >
              <Mic2 className="size-4 text-warning" /> Voice-first access
            </motion.span>
          </motion.div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border bg-surface py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span>Varsha Setu · Team Nexus · 2026</span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-3 text-success" /> Systems operational
          </span>
        </div>
      </footer>
    </main>
  );
}
