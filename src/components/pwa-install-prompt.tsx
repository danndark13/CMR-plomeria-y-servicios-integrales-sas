'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone, HelpCircle, Share, PlusSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIos) {
        toast({
          title: "Instalación en iPhone",
          description: "Pulsa 'Compartir' y luego 'Añadir a pantalla de inicio'.",
        });
      } else {
        toast({
          title: "Instalación Manual",
          description: "Usa el menú (⋮) de tu navegador y selecciona 'Instalar aplicación'.",
        });
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible && !isIos) return null;
  // En iOS no mostramos el prompt flotante siempre, solo si no es standalone
  if (isIos && window.matchMedia('(display-mode: standalone)').matches) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 z-[100] md:left-auto md:right-8 md:w-96 animate-in slide-in-from-bottom-10 duration-500">
      <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden ring-4 ring-white/20">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-black uppercase leading-tight tracking-tight">App RYS Gestión</p>
                <p className="text-[9px] opacity-80 font-medium leading-tight">Instálala para un acceso rápido y profesional.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="bg-white text-primary hover:bg-white/90 font-black h-8 px-4 rounded-lg text-[10px]"
                onClick={handleInstallClick}
              >
                {isIos ? "CÓMO INSTALAR" : "INSTALAR"}
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 hover:bg-white/10"
                onClick={() => setIsVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {isIos && (
            <div className="pt-2 border-t border-white/10 flex items-center justify-center gap-4">
               <div className="flex items-center gap-1 text-[9px] font-bold">
                 <Share className="h-3 w-3" /> Compartir
               </div>
               <div className="flex items-center gap-1 text-[9px] font-bold">
                 <PlusSquare className="h-3 w-3" /> Añadir a inicio
               </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
