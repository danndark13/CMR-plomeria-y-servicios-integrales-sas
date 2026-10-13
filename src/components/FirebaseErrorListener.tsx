'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (permissionError: FirestorePermissionError) => setError(permissionError);
    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, []);

  if (!error) return null;
  const { method, path } = error.request;

  return (
    <div role="alert" className="fixed bottom-4 right-4 z-[100] w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-red-300 bg-white p-4 text-sm text-red-950 shadow-xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Firebase bloqueó una operación por permisos</p>
          <p className="mt-1 break-all text-xs text-red-800">{method.toUpperCase()} · {path}</p>
          <p className="mt-2 text-xs text-slate-600">Si el usuario está autenticado, este error suele indicar reglas no publicadas o que la app está conectada a otro proyecto Firebase. Publica las reglas en el proyecto conectado y confirma el perfil activo.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Cerrar aviso" className="h-7 w-7 shrink-0" onClick={() => setError(null)}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
