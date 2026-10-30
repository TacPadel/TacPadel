import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export default function Effects({ lowQuality = false }: { lowQuality?: boolean }) {
  return (
    <EffectComposer 
      disableNormalPass={true} 
      multisampling={0} 
      // Selbst auf alten Handys bleibt der Glow an, wird dort aber auf 0.5 berechnet
      resolutionScale={lowQuality ? 0.5 : 0.85} 
    >
      <Bloom 
        mipmapBlur={true} 
        levels={lowQuality ? 3 : 5} 
        intensity={1.5} 
        luminanceThreshold={0.8} 
        luminanceSmoothing={0.2} 
      />
      
      {/* @ts-ignore */}
      <Vignette offset={0.1} darkness={0.6} />
    </EffectComposer>
  );
}