import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export default function Effects() {
  return (
    <EffectComposer 
      disableNormalPass={true} 
      multisampling={0} // Verhindert teures 8x MSAA auf Smartphones
       resolutionScale={0.75} // Reduziert die Puffer-Last spürbar ohne sichtbaren Qualitätsverlust
    >
      <Bloom 
        mipmapBlur={true} 
        levels={4} // Reduziert die Blur-Durchgänge von 8 auf 4 (gleicher Look, halbe GPU-Last)
        intensity={1.5} 
        luminanceThreshold={0.8} 
        luminanceSmoothing={0.2} 
      />
      
      {/* @ts-ignore - Behebt den falschen TypeScript-Fehler in der Postprocessing-Bibliothek */}
      <Vignette offset={0.1} darkness={0.6} />
    </EffectComposer>
  );
}