import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AsistenciaPro RYS SAS',
    short_name: 'AsistenciaPro',
    description: 'Sistema de Gestión de Servicios y CRM para RYS SAS',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#1F5BCC',
    icons: [
      {
        src: 'https://picsum.photos/seed/rys-icon/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/rys-icon/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
