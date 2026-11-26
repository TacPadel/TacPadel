import React, { Component, Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  DEFAULT_RACKET,
  DEFAULT_RACKET_URL,
  SHOP_RACKETS,
  resolveRacketAsset,
  type RacketTransform,
} from "../lib/loadout";

const preloadedUrls = new Set<string>();

function preloadUrlOnce(url: string): void {
  if (preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  useGLTF.preload(url);
}

export function preloadEquippedRacket(racketId?: string | null): void {
  preloadUrlOnce(DEFAULT_RACKET_URL);
  preloadUrlOnce(resolveRacketAsset(racketId).url);
}

export function preloadAllShopRackets(): void {
  SHOP_RACKETS.forEach((racket) => preloadUrlOnce(racket.modelUrl));
}

interface ErrorBoundaryProps {
  resetKey: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class RacketErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface RacketModelInstanceProps {
  url: string;
  offset?: RacketTransform;
  castShadow: boolean;
  receiveShadow: boolean;
}

function RacketModelInstance({
  url,
  offset,
  castShadow,
  receiveShadow,
}: RacketModelInstanceProps) {
  const { scene } = useGLTF(url);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
      }
    });
    return clone;
  }, [scene, castShadow, receiveShadow]);

  return (
    <primitive
      object={clonedScene}
      position={offset?.position as [number, number, number] | undefined}
      rotation={offset?.rotation as [number, number, number] | undefined}
      scale={offset?.scale as number | [number, number, number] | undefined}
    />
  );
}

export interface RacketMeshProps {
  racketId?: string | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function RacketMesh({
  racketId,
  position,
  rotation,
  scale = 1,
  visible = true,
  castShadow = true,
  receiveShadow = false,
}: RacketMeshProps) {
  const asset = resolveRacketAsset(racketId);
  const isClassic = asset.url === DEFAULT_RACKET_URL;

  const fallbackNode = (
    <Suspense fallback={null}>
      <RacketModelInstance
        url={DEFAULT_RACKET.modelUrl}
        offset={DEFAULT_RACKET.modelOffset}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    </Suspense>
  );

  return (
    <group position={position} rotation={rotation} scale={scale} visible={visible}>
      {isClassic ? (
        fallbackNode
      ) : (
        <RacketErrorBoundary resetKey={asset.url} fallback={fallbackNode}>
          <Suspense fallback={fallbackNode}>
            <RacketModelInstance
              url={asset.url}
              offset={asset.offset}
              castShadow={castShadow}
              receiveShadow={receiveShadow}
            />
          </Suspense>
        </RacketErrorBoundary>
      )}
    </group>
  );
}