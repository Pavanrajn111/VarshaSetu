import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type SceneColors = {
  ocean: string;
  atmosphere: string;
  grid: string;
  signal: string;
  warning: string;
  cloud: string;
};

function readSceneColors(): SceneColors {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    ocean: read("--scene-ocean"),
    atmosphere: read("--scene-atmosphere"),
    grid: read("--scene-grid"),
    signal: read("--scene-signal"),
    warning: read("--scene-warning"),
    cloud: read("--scene-cloud"),
  };
}

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Evenly distributed dots over the sphere — gives the globe a "data surface" look. */
function DotShell({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      positions[i * 3] = Math.cos(theta) * r * 2.02;
      positions[i * 3 + 1] = y * 2.02;
      positions[i * 3 + 2] = Math.sin(theta) * r * 2.02;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.028}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Fresnel rim so the sphere reads as a lit planet instead of a flat disc. */
function RimGlow({ color }: { color: string }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.4);
            gl_FragColor = vec4(uColor, rim * 0.9);
          }
        `,
      }),
    [color],
  );

  return (
    <mesh scale={1.14} material={material}>
      <sphereGeometry args={[2, 48, 48]} />
    </mesh>
  );
}

function arcBetween(a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5).setLength(2.55);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return curve.getPoints(40);
}

function Globe({ colors, reduceMotion }: { colors: SceneColors; reduceMotion: boolean }) {
  const globe = useRef<THREE.Group>(null);
  const cloudBand = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const spin = useRef(-1.25);

  const marker = useMemo(() => latLonToVector3(14.5, 75.7, 2.08), []);
  const networkPoints = useMemo(
    () => [
      latLonToVector3(12.97, 77.59, 2.07),
      latLonToVector3(15.31, 75.71, 2.07),
      latLonToVector3(13.34, 74.74, 2.07),
      latLonToVector3(16.83, 75.71, 2.07),
      latLonToVector3(14.62, 74.84, 2.07),
    ],
    [],
  );
  const arcs = useMemo(
    () =>
      networkPoints
        .slice(1)
        .map((point) => arcBetween(networkPoints[0]!, point)),
    [networkPoints],
  );

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const damp = 1 - Math.exp(-3.2 * delta);

    if (globe.current) {
      // Continuous drift + cursor-driven rotation on both axes.
      if (!reduceMotion) spin.current -= delta * 0.09;
      const targetY = spin.current + state.pointer.x * 1.25;
      globe.current.rotation.y = THREE.MathUtils.lerp(globe.current.rotation.y, targetY, damp);
      globe.current.rotation.x = THREE.MathUtils.lerp(
        globe.current.rotation.x,
        0.08 + state.pointer.y * 0.5,
        damp,
      );
    }
    if (cloudBand.current && !reduceMotion) cloudBand.current.rotation.y -= delta * 0.14;

    if (pulse.current && !reduceMotion) {
      const t = (state.clock.elapsedTime % 2.4) / 2.4;
      const s = 1 + t * 2.2;
      pulse.current.scale.setScalar(s);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    }
  });

  return (
    <group ref={globe} rotation={[0.08, -1.25, 0]}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhysicalMaterial
          color={colors.ocean}
          emissive={colors.atmosphere}
          emissiveIntensity={0.42}
          metalness={0.45}
          roughness={0.42}
          clearcoat={0.6}
        />
      </mesh>

      <DotShell color={colors.grid} />

      <mesh scale={1.02}>
        <sphereGeometry args={[2, 36, 24]} />
        <meshBasicMaterial color={colors.grid} wireframe transparent opacity={0.16} />
      </mesh>

      <RimGlow color={colors.atmosphere} />

      <group ref={cloudBand} rotation={[0.42, 0.1, 0.2]}>
        {[-0.72, -0.35, -0.05, 0.3, 0.68].map((y, index) => (
          <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[Math.sqrt(4 - y * y), 0.03 + index * 0.004, 8, 128]} />
            <meshBasicMaterial
              color={colors.cloud}
              transparent
              opacity={0.3 - index * 0.03}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {arcs.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={colors.signal}
          lineWidth={1.1}
          transparent
          opacity={0.5}
        />
      ))}
      <Line points={networkPoints} color={colors.signal} lineWidth={1.4} transparent opacity={0.7} />

      {networkPoints.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[index === 0 ? 0.055 : 0.035, 12, 12]} />
          <meshBasicMaterial color={index === 0 ? colors.warning : colors.signal} />
        </mesh>
      ))}

      <mesh position={marker}>
        <ringGeometry args={[0.09, 0.13, 32]} />
        <meshBasicMaterial color={colors.warning} side={THREE.DoubleSide} transparent />
      </mesh>
      <mesh ref={pulse} position={marker}>
        <ringGeometry args={[0.1, 0.125, 32]} />
        <meshBasicMaterial color={colors.warning} side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

export function ClimateGlobe({ reduceMotion }: { reduceMotion: boolean }) {
  const [colors, setColors] = useState<SceneColors | null>(null);

  useEffect(() => setColors(readSceneColors()), []);

  if (!colors) return <div className="h-full w-full animate-pulse rounded-full bg-glass" />;

  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.1, 7.2], fov: 43 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 6]} intensity={2.6} color={colors.signal} />
      <directionalLight position={[-5, 2, -4]} intensity={1.4} color={colors.cloud} />
      <pointLight position={[-4, -1, 3]} intensity={22} color={colors.warning} distance={13} />
      <Globe colors={colors} reduceMotion={reduceMotion} />
      <Sparkles
        count={reduceMotion ? 30 : 110}
        scale={[9, 6.5, 5]}
        size={1.4}
        speed={reduceMotion ? 0 : 0.24}
        opacity={0.45}
        color={colors.signal}
      />
    </Canvas>
  );
}
