
"use client"

import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { CRMSidebar } from '@/components/crm/crm-sidebar';
import { Toaster } from '@/components/ui/toaster';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const isDashboard = pathname === '/';

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
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur transition-all">
                  {!isDashboard && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2 text-muted-foreground hover:text-primary"
                      onClick={() => router.back()}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Regresar
                    </Button>
                  )}
                  <div className="flex-1" />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                    {pathname === '/' ? 'Resumen General' : pathname.split('/').filter(Boolean).join(' > ')}
                  </div>
                </header>
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
