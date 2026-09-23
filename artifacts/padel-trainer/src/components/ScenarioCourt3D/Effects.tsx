import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export default function Effects() {
  return (
    <EffectComposer disableNormalPass={true}>
      <Bloom 
        mipmapBlur={true} 
        intensity={1.5} 
        luminanceThreshold={0.8} 
        luminanceSmoothing={0.2} 
      />
      
      {/* @ts-ignore - Behebt den falschen TypeScript-Fehler in der Postprocessing-Bibliothek */}
      <Vignette offset={0.1} darkness={0.6} />
    </EffectComposer>
  );
}