
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Wallet, HandCoins, Calendar, Info, CheckCircle2 } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where } from "firebase/firestore"

export default function TechnicianSettlementsPage() {
  const db = useFirestore()
  const { user } = useUser()

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  const settlementsQuery = useMemoFirebase(() => {
    if (!db || !profile) return null
    return query(collection(db, "payroll_history"), where("technicianId", "==", profile.username))
  }, [db, profile])

  const { data: history, isLoading } = useCollection(settlementsQuery)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consultando tus pagos...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Mis Liquidaciones</h1>
        <p className="text-muted-foreground font-medium">Historial de pagos procesados y conciliados por Contabilidad.</p>
      </div>

      <div className="grid gap-6">
        {history?.length === 0 ? (
          <Card className="border-dashed py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Wallet className="h-12 w-12 opacity-10 mb-4" />
            <p className="text-lg font-bold">No tienes pagos registrados todavía</p>
            <p className="text-xs uppercase font-black tracking-tighter">Tus liquidaciones aparecerán aquí una vez procesadas.</p>
          </Card>
        ) : (
          history?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((liq) => (
            <Card key={liq.id} className="overflow-hidden border-none shadow-lg border-l-4 border-l-green-500">
              <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest">Liquidación: {liq.id}</span>
                    <p className="text-[10px] text-white/60 font-medium uppercase flex items-center gap-2">
                      <Calendar className="h-3 w-3" /> {new Date(liq.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Neto Pagado</p>
                  <p className="text-2xl font-black text-green-400">${liq.netPaid.toLocaleString()}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 border-b pb-1">Resumen de Servicios</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase">
                        <span className="text-slate-500">Base Participación:</span>
                        <span className="font-mono">${liq.amountToSplit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black uppercase text-primary pt-2 border-t">
                        <span>Mi Parte (50%):</span>
                        <span className="font-mono">${(liq.amountToSplit / 2).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-destructive border-b pb-1">Deducciones</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase text-destructive/70">
                        <span>Materiales/Alquiler:</span>
                        <span className="font-mono">-${(liq.totalExpenses + liq.totalRentals).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold uppercase text-destructive">
                        <span>Adelantos:</span>
                        <span className="font-mono">-${liq.totalAdvances.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-blue-600 border-b pb-1">Ajustes Especiales</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase text-blue-600">
                        <span>Ajuste Manual:</span>
                        <span className="font-mono">${liq.adjustmentAmount.toLocaleString()}</span>
                      </div>
                      {liq.adjustmentReason && (
                        <p className="text-[9px] text-slate-400 italic">Motivo: {liq.adjustmentReason}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-[9px] font-bold uppercase text-slate-500">
                  <Info className="h-4 w-4" />
                  Esta liquidación incluye {liq.itemsCount} reportes de servicios. Los descuentos de materiales y alquileres se restan del valor bruto antes de la repartición 50/50.
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
