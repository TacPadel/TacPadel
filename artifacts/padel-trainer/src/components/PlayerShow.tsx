import React from 'react';
import { useGLTF } from '@react-three/drei';

export default function PlayerShow() {
  // Lädt dein 3D-Modell direkt aus dem public-Ordner
  const { scene } = useGLTF('/PlayerShow.glb');

  return (
    <primitive 
      object={scene} 
      scale={1.25}            // Hier kannst du die Größe anpassen (z. B. 1.5 für größer)
      position={[0, -1.2, 0]} // Hier kannst du die Höhe/Position (x, y, z) anpassen
    />
  );
}