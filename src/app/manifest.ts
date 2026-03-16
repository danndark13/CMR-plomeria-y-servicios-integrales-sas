import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RYS Gestión Operativa',
    short_name: 'RYS Gestión',
    description: 'Sistema de Gestión de Servicios y CRM para RYS SAS',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1F5BCC',
    icons: [
      {
        src: 'https://picsum.photos/seed/rys-192/192/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://picsum.photos/seed/rys-512/512/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    orientation: 'portrait',
    scope: '/',
  }
}
