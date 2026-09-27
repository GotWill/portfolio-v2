// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Fonts API nativa (estável desde Astro 6, sem flag experimental): baixa
  // e serve Poppins/JetBrains Mono pelo próprio domínio em vez de um
  // <link> pra fonts.googleapis.com — evita a requisição extra pro Google
  // e já gera preload automaticamente via <Font preload />.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Poppins',
      cssVariable: '--font-display',
      weights: [400, 600, 700],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
    },
  ],
});
