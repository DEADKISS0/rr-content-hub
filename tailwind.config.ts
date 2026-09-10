import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        fucsia: '#be076d',
        mostaza: '#ded116',
        orquidea: '#973d8f',
        blanco: '#fffff3',
        negro: '#070001',
      },
      fontFamily: {
        display: ['Neue Haas Grotesk', 'Helvetica Neue', 'sans-serif'],
        body: ['Graphie', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        brutal: '4px 4px 0 #be076d',
        'brutal-lg': '8px 8px 0 #be076d',
        'brutal-mostaza': '4px 4px 0 #ded116',
      },
      borderWidth: {
        brutal: '4px',
      },
    },
  },
  plugins: [],
};

export default config;
