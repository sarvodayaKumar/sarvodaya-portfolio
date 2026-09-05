"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "./ThemeProvider";
import { profile } from "@/data/profile";

const vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = `
uniform sampler2D uMap;
uniform float uTime;
uniform vec3 uAccent;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  float wave = sin(uTime * 1.4 + uv.y * 8.0) * 0.004;
  float scan = 0.08 * (0.5 + 0.5 * sin((uv.y * 140.0) - uTime * 8.0));
  float band = smoothstep(0.04, 0.0, abs(fract(uv.y - uTime * 0.18) - 0.12));
  vec2 rUv = uv + vec2(0.004 + wave, 0.0);
  vec2 bUv = uv - vec2(0.004 + wave, 0.0);
  vec3 color = vec3(
    texture2D(uMap, rUv).r,
    texture2D(uMap, uv).g,
    texture2D(uMap, bUv).b
  );
  color += uAccent * (scan * 0.55 + band * 0.35);
  color *= 0.92 + 0.08 * sin(uTime * 2.2);
  gl_FragColor = vec4(color, 1.0);
}
`;

function useHoloMaterial(texture: THREE.Texture, accent: string) {
  return useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uTime: { value: 0 },
        uAccent: { value: new THREE.Color(accent) },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    return mat;
  }, [texture, accent]);
}

function PortraitFigure({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  const holo = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Mesh>(null);
  const scan = useRef<THREE.Mesh>(null);
  const target = useRef({ x: 0, y: 0 });
  const texture = useTexture(profile.avatar);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const accent = dark ? "#2dd4bf" : "#0f766e";
  const holoMat = useHoloMaterial(texture, accent);
  const ghostMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [texture]
  );
  const frame = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: dark ? "#1c2129" : "#ece7dc",
        metalness: 0.35,
        roughness: 0.38,
      }),
    [dark]
  );
  const photo = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.45,
        metalness: 0.06,
      }),
    [texture]
  );

  const dust = useMemo(() => {
    const positions = new Float32Array(240);
    for (let i = 0; i < 80; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.15 + Math.random() * 0.7;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
      positions[i * 3 + 2] = Math.sin(a) * r * 0.45;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      target.current.x = (event.clientX / window.innerWidth - 0.5) * 0.5;
      target.current.y = (event.clientY / window.innerHeight - 0.5) * 0.26;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    holoMat.uniforms.uTime.value = t;
    if (group.current) {
      group.current.rotation.y += (target.current.x - group.current.rotation.y) * 0.07;
      group.current.rotation.x += (-target.current.y - group.current.rotation.x) * 0.07;
      group.current.position.y = Math.sin(t * 0.9) * 0.08;
    }
    if (holo.current) {
      holo.current.position.z = 0.12 + Math.sin(t * 1.6) * 0.02;
    }
    if (ghost.current) {
      ghost.current.position.x = Math.sin(t * 1.1) * 0.05;
      ghost.current.position.z = -0.28;
      const mat = ghost.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.4));
    }
    if (scan.current) {
      scan.current.position.y = Math.sin(t * 1.15) * 1.15;
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.1]}>
        <torusGeometry args={[1.68, 0.016, 12, 80]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.45}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>

      <mesh material={[frame, frame, frame, frame, photo, frame]}>
        <boxGeometry args={[2.02, 2.68, 0.14]} />
      </mesh>

      <mesh ref={holo} position={[0, 0, 0.12]}>
        <planeGeometry args={[1.98, 2.64]} />
        <primitive object={holoMat} attach="material" />
      </mesh>

      <mesh ref={ghost} scale={[1.08, 1.08, 1]}>
        <planeGeometry args={[1.98, 2.64]} />
        <primitive object={ghostMat} attach="material" />
      </mesh>

      <mesh ref={scan} position={[0, 0, 0.14]}>
        <planeGeometry args={[1.98, 0.045]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} />
      </mesh>

      <points geometry={dust}>
        <pointsMaterial
          size={0.028}
          color={accent}
          transparent
          opacity={0.7}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

export default function HeroPortrait3D() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="relative mx-auto h-[440px] w-full max-w-[440px] lg:h-[580px] lg:max-w-none">
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 4.4], fov: 32 }}
      >
        <ambientLight intensity={dark ? 0.5 : 0.8} />
        <spotLight
          position={[3.5, 4.5, 6]}
          angle={0.45}
          penumbra={0.7}
          intensity={dark ? 48 : 30}
          color={dark ? "#e2e8f0" : "#fff7ed"}
        />
        <pointLight position={[-3, -1, 3]} intensity={dark ? 14 : 9} color={dark ? "#2dd4bf" : "#0f766e"} />
        <Suspense fallback={null}>
          <PortraitFigure dark={dark} />
        </Suspense>
        <ContactShadows
          position={[0, -1.58, 0]}
          opacity={dark ? 0.38 : 0.2}
          scale={7}
          blur={2.6}
          far={4}
        />
      </Canvas>
    </div>
  );
}
