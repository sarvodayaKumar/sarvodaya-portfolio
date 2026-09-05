"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { portraitFrames } from "@/data/portraits";
import { useTheme } from "./ThemeProvider";

const vertex = `
varying vec2 vUv;
uniform sampler2D uFront;
uniform float uTime;

void main() {
  vUv = uv;
  vec3 color = texture2D(uFront, uv).rgb;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  float face = smoothstep(0.32, 0.52, uv.y);
  float depth = smoothstep(0.18, 0.72, luma) * 0.28 * face;
  float breath = sin(uTime * 1.15) * 0.012;
  vec3 pos = position;
  pos.z += depth + breath * face;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragment = `
uniform sampler2D uFront;
uniform sampler2D uLeft;
uniform sampler2D uRight;
uniform float uLookX;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec4 front = texture2D(uFront, vUv);
  vec4 left = texture2D(uLeft, vUv);
  vec4 right = texture2D(uRight, vUv);
  float leftAmt = smoothstep(0.04, 0.92, max(-uLookX, 0.0));
  float rightAmt = smoothstep(0.04, 0.92, max(uLookX, 0.0));
  vec3 color = mix(front.rgb, left.rgb, leftAmt);
  color = mix(color, right.rgb, rightAmt);

  vec2 p = (vUv - vec2(0.5, 0.4)) / vec2(0.36, 0.5);
  float mask = 1.0 - smoothstep(0.68, 1.04, length(p));
  mask *= smoothstep(0.0, 0.1, vUv.y);
  mask *= smoothstep(1.0, 0.9, vUv.y);
  mask *= smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);

  if (mask < 0.04) discard;

  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color *= 0.78 + luma * 0.38;
  gl_FragColor = vec4(color, mask);
}
`;

function usePortraitMaterial(maps: THREE.Texture[]) {
  return useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uFront: { value: maps[0] },
        uLeft: { value: maps[1] ?? maps[0] },
        uRight: { value: maps[2] ?? maps[0] },
        uLookX: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: true,
    });
    return mat;
  }, [maps]);
}

function isOnPortrait(uv: THREE.Vector2) {
  const px = (uv.x - 0.5) / 0.36;
  const py = (uv.y - 0.4) / 0.5;
  return px * px + py * py <= 1;
}

function PortraitFigure() {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const hovered = useRef(false);
  const textures = useTexture(portraitFrames);
  const maps = useMemo(() => {
    const list = (Array.isArray(textures) ? textures : [textures]) as THREE.Texture[];
    list.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
    });
    return list;
  }, [textures]);
  const material = usePortraitMaterial(maps);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!hovered.current) {
      pointer.current.x += (0 - pointer.current.x) * 0.12;
      pointer.current.y += (0 - pointer.current.y) * 0.12;
    }
    const x = pointer.current.x;
    const y = pointer.current.y;
    material.uniforms.uTime.value = t;
    material.uniforms.uLookX.value += (x - material.uniforms.uLookX.value) * 0.08;
    state.gl.domElement.style.cursor = hovered.current ? "pointer" : "auto";

    if (!group.current) return;
    group.current.rotation.y += (x * 0.58 - group.current.rotation.y) * 0.1;
    group.current.rotation.x += (-y * 0.24 - group.current.rotation.x) * 0.1;
    group.current.position.x += (x * 0.28 - group.current.position.x) * 0.08;
    group.current.position.y += (Math.sin(t * 1.05) * 0.05 + y * 0.16 - group.current.position.y) * 0.08;
    group.current.position.z = Math.sin(t * 0.7) * 0.05;
  });

  return (
    <group ref={group}>
      <mesh
        onPointerMove={(event) => {
          event.stopPropagation();
          const uv = event.uv;
          if (!uv || !isOnPortrait(uv)) {
            hovered.current = false;
            return;
          }
          hovered.current = true;
          pointer.current.x = (uv.x - 0.5) * 2;
          pointer.current.y = (uv.y - 0.5) * 2;
        }}
        onPointerOut={() => {
          hovered.current = false;
        }}
      >
        <planeGeometry args={[2.55, 3.35, 64, 80]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

export default function HeroPortrait3D() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[520px] lg:h-[620px] lg:max-w-none">
      <Canvas
        className="h-full w-full touch-none"
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.12, 3.55], fov: 34 }}
      >
        <hemisphereLight
          color={dark ? "#9aa7b8" : "#f4efe6"}
          groundColor={dark ? "#0b0e13" : "#d7d0c4"}
          intensity={dark ? 0.55 : 0.85}
        />
        <spotLight
          position={[2.4, 2.8, 5.2]}
          angle={0.55}
          penumbra={0.85}
          intensity={dark ? 55 : 38}
          color={dark ? "#f3efe6" : "#fffaf2"}
        />
        <pointLight
          position={[-2.8, 0.6, 2.4]}
          intensity={dark ? 10 : 7}
          color={dark ? "#7dd3c7" : "#5f8f88"}
        />
        <spotLight
          position={[-1.6, 2.2, -1.2]}
          angle={0.7}
          penumbra={1}
          intensity={dark ? 18 : 10}
          color={dark ? "#2dd4bf" : "#0f766e"}
        />
        <Suspense fallback={null}>
          <PortraitFigure />
        </Suspense>
        <ContactShadows
          position={[0, -1.72, 0]}
          opacity={dark ? 0.42 : 0.22}
          scale={8}
          blur={2.8}
          far={4.5}
        />
      </Canvas>
    </div>
  );
}
