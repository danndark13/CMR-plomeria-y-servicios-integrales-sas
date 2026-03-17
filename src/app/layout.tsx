
"use client"

import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { CRMSidebar } from '@/components/crm/crm-sidebar';
import { Toaster } from '@/components/ui/toaster';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu as HamburgerIcon } from 'lucide-react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { AuthGuard } from '@/components/auth-guard';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const isDashboard = pathname === '/';

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(
          function(registration) {
            console.log('RYS PWA: Service Worker registrado con éxito:', registration.scope);
          },
          function(err) {
            console.error('RYS PWA: Error al registrar Service Worker:', err);
          }
        );
      });
    }
  }, []);

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        
        {/* PWA Meta Tags */}
        <meta name="application-name" content="RYS Gestión" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RYS Gestión" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1F5BCC" />
        <link rel="manifest" href="/manifest.json" />
        
        <title>RYS Gestión - CRM Operativo</title>
      </head>
      <body className="font-body antialiased bg-slate-50">
        <FirebaseClientProvider>
          <AuthGuard>
            {isLoginPage ? (
              <main>{children}</main>
            ) : (
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <CRMSidebar />
                  <SidebarInset className="flex-1 flex flex-col min-w-0">
                    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b bg-white/80 px-6 backdrop-blur-xl transition-all shadow-sm">
                      <SidebarTrigger className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-all">
                        <HamburgerIcon className="h-6 w-6" />
                      </SidebarTrigger>
                      
                      {!isDashboard && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-2 text-slate-500 hover:text-primary font-bold"
                          onClick={() => router.back()}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Regresar</span>
                        </Button>
                      )}
                      
                      <div className="flex-1" />
                      
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-80 hidden md:block">
                          {pathname === '/' ? 'Resumen General' : pathname.split('/').filter(Boolean).join(' > ')}
                        </div>
                      </div>
                    </header>
                    <main className="flex-1 overflow-y-auto container mx-auto p-6 md:p-8 lg:p-10 animate-in fade-in duration-500">
                      {children}
                    </main>
                  </SidebarInset>
                </div>
                <ChatWidget />
              </SidebarProvider>
            )}
          </AuthGuard>
          <PWAInstallPrompt />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
