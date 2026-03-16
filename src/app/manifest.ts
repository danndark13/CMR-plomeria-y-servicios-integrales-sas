import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RYS Gestión',
    short_name: 'RYS',
    description: 'Sistema de Gestión de Servicios y CRM para RYS SAS',
    start_url: '/',
    scope: '/',
    id: '/rys-gestion-v1',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1F5BCC',
    icons: [
      {
        src: 'https://picsum.photos/seed/rys-logo-white/192/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://picsum.photos/seed/rys-logo-white/512/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
