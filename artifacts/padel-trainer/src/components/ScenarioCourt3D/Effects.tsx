import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export default function Effects({ lowQuality = false }: { lowQuality?: boolean }) {
  return (
    <EffectComposer 
      disableNormalPass={true}
      // Standardmäßig 8 (dein scharfer Original-Look), nur im Eco-Modus 0
      multisampling={lowQuality ? 0 : 8}
    >
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