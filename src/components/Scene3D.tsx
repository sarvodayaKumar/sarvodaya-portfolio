"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "./ThemeProvider";

function CameraRig() {
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      target.current.x = (event.clientX / window.innerWidth - 0.5) * 1.4;
      target.current.y = (event.clientY / window.innerHeight - 0.5) * -0.8;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(({ camera }) => {
    camera.position.x += (target.current.x - camera.position.x) * 0.035;
    camera.position.y += (target.current.y - camera.position.y) * 0.035;
    camera.position.z = 6.2;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Crystal({
  position,
  color,
  scale,
  speed,
}: {
  position: [number, number, number];
  color: string;
  scale: number;
  speed: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.x = state.clock.elapsedTime * speed;
    mesh.current.rotation.y = state.clock.elapsedTime * speed * 0.7;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.5} floatIntensity={1.4}>
      <mesh ref={mesh} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          metalness={0.82}
          roughness={0.18}
          transparent
          opacity={0.88}
        />
      </mesh>
    </Float>
  );
}

function WireTorus({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.x = state.clock.elapsedTime * 0.18;
    mesh.current.rotation.z = state.clock.elapsedTime * 0.12;
  });

  return (
    <mesh ref={mesh} position={position}>
      <torusGeometry args={[1.8, 0.015, 16, 96]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

// Computed once at module load, not during render — Math.random() during
// render trips React's purity rule, and this field never needs to change.
const DUST_POSITIONS = (() => {
  const positions = new Float32Array(900);
  for (let i = 0; i < 300; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  return positions;
})();

function Dust() {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(DUST_POSITIONS, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={0.025} color="#bae6fd" transparent opacity={0.55} />
    </points>
  );
}

export default function Scene3D() {
  const { theme } = useTheme();
  const light = theme === "light";

  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6.2], fov: 42 }}
    >
      <ambientLight intensity={light ? 0.7 : 0.35} />
      <pointLight position={[4, 3, 6]} intensity={light ? 10 : 18} color={light ? "#0f766e" : "#67e8f9"} />
      <pointLight position={[-6, -2, 4]} intensity={light ? 7 : 12} color={light ? "#57534e" : "#818cf8"} />
      <Stars
        radius={60}
        depth={40}
        count={light ? 400 : 1400}
        factor={light ? 2 : 3}
        saturation={0}
        fade
        speed={0.4}
      />
      <Dust />
      <WireTorus position={[0.2, 0.4, -1.5]} color={light ? "#0f766e" : "#67e8f9"} />
      <WireTorus position={[-0.8, -0.6, -2.2]} color={light ? "#44403c" : "#a78bfa"} />
      <Crystal position={[-3.4, 1.6, -1]} color={light ? "#0d9488" : "#22d3ee"} scale={0.55} speed={0.22} />
      <Crystal position={[3.6, 0.8, -1.4]} color={light ? "#57534e" : "#818cf8"} scale={0.72} speed={0.16} />
      <Crystal position={[2.4, -1.8, -0.6]} color={light ? "#115e59" : "#2dd4bf"} scale={0.38} speed={0.28} />
      <Crystal position={[-2.8, -1.4, -1.8]} color={light ? "#78716c" : "#38bdf8"} scale={0.32} speed={0.2} />
      <CameraRig />
    </Canvas>
  );
}
