
"use client"

import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { CRMSidebar } from '@/components/crm/crm-sidebar';
import { Toaster } from '@/components/ui/toaster';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <title>AsistenciaPro CRM</title>
      </head>
      <body className="font-body antialiased">
        {isLoginPage ? (
          <main>{children}</main>
        ) : (
          <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
              <CRMSidebar />
              <SidebarInset className="flex-1 overflow-auto">
                <main className="container mx-auto p-6 md:p-8 lg:p-10">
                  {children}
                </main>
              </SidebarInset>
            </div>
          </SidebarProvider>
        )}
        <Toaster />
      </body>
    </html>
  );
}
