
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Package, 
  Plus, 
  Warehouse, 
  Users, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Loader2,
  Save,
  X,
  History,
  AlertCircle,
  PackageCheck,
  ArrowRightLeft,
  RotateCcw,
  Info
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { ServiceRequest, Expense } from "@/lib/types"
import { MOCK_TECHNICIANS, MOCK_REQUESTS } from "@/lib/mock-data"

export default function InventoryPage() {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  // 1. Fetch Warehouse Inventory
  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "inventory")
  }, [db, user])
  const { data: inventoryItems, isLoading: isInventoryLoading } = useCollection(inventoryQuery)

  // 2. Fetch Technicians
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: firestoreUsers } = useCollection(usersQuery)

  // 3. Fetch Service Requests
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  const isTech = profile?.roleId === 'Técnico'

  // Combinar Técnicos
  const allTechnicians = firestoreUsers 
    ? [
        ...firestoreUsers.filter(u => u.roleId === 'Técnico'),
        ...MOCK_TECHNICIANS.filter(mt => !firestoreUsers.find(fu => fu.username === mt.id || fu.id === mt.id))
      ]
    : MOCK_TECHNICIANS

  // Combinar Solicitudes
  const allRequests = firestoreRequests 
    ? [...firestoreRequests, ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.claimNumber === mr.claimNumber))]
    : MOCK_REQUESTS

  const getFieldStockForTech = (techId: string) => {
    const unusedExpenses: Expense[] = []
    allRequests.forEach((req: ServiceRequest) => {
      (req.interventions || []).forEach((interv: any) => {
        if (interv.technicianId === techId) {
          (interv.detailedExpenses || []).forEach((exp: any) => {
            if (exp.isUnused === true && !exp.isReturned) {
              unusedExpenses.push(exp)
            }
          })
        }
      })
    })

    const grouped = unusedExpenses.reduce((acc: Record<string, { description: string, quantity: number, unit: string, unitValue: number }>, exp: Expense) => {
      const key = exp.description.toUpperCase().trim()
      if (!acc[key]) {
        acc[key] = { description: key, quantity: 0, unit: exp.unit || 'UND', unitValue: exp.unitValue || 0 }
      }
      acc[key].quantity += (exp.quantity || 1)
      return acc
    }, {} as Record<string, { description: string, quantity: number, unit: string, unitValue: number }>)

    return Object.values(grouped)
  }

  const handleReturnToWarehouse = async (techId: string, itemDescription: string, quantityToReturn: number, unitValue: number) => {
    if (!db) return
    setIsProcessing(true)

    try {
      const batch = writeBatch(db)
      let remainingToProcess = quantityToReturn

      for (const req of allRequests) {
        if (remainingToProcess <= 0) break
        const totalExpenses = (allRequests || []).reduce((acc: number, req: ServiceRequest) => {
          const expenses = (req.interventions || []).reduce((s: number, interv: any) => {
            const materialCosts = (interv.detailedExpenses || []).filter((exp: any) => !exp.isUnused).reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0)
            return s + materialCosts
          }, 0)
          return acc + expenses
        }, 0)
        const updatedInterventions = (req.interventions || []).map((interv: any) => {
          if (interv.technicianId !== techId) return interv
          const updatedExpenses = (interv.detailedExpenses || []).map((exp: any) => {
            if (remainingToProcess > 0 && exp.description.toUpperCase().trim() === itemDescription.toUpperCase().trim() && exp.isUnused && !exp.isReturned) {
              const returningFromThis = Math.min(remainingToProcess, exp.quantity || 1)
              remainingToProcess -= returningFromThis
              return { ...exp, isReturned: true }
            }
            return exp
          })
          return { ...interv, detailedExpenses: updatedExpenses }
        })
        if (JSON.stringify(req.interventions) !== JSON.stringify(updatedInterventions)) {
          batch.update(doc(db, "service_requests", req.id), { interventions: updatedInterventions, updatedAt: new Date().toISOString() })
        }
      }

      const existingItem = (inventoryItems || []).find(i => i.description.toUpperCase().trim() === itemDescription.toUpperCase().trim())
      if (existingItem) {
        batch.update(doc(db, "inventory", existingItem.id), { quantity: existingItem.quantity + quantityToReturn, updatedAt: serverTimestamp() })
      } else {
        const newItemRef = doc(collection(db, "inventory"))
        batch.set(newItemRef, { description: itemDescription.toUpperCase().trim(), quantity: quantityToReturn, unitValue: unitValue, updatedAt: serverTimestamp(), lastModifiedBy: user?.uid || "SISTEMA" })
      }

      await batch.commit()
      toast({ title: "Retorno Procesado" })
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user) return
    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const newItem = {
      description: (formData.get("description") as string).toUpperCase(),
      quantity: Number(formData.get("quantity")),
      unitValue: Number(formData.get("unitValue")),
      updatedAt: serverTimestamp(),
      lastModifiedBy: user.uid
    }
    addDoc(collection(db, "inventory"), newItem).then(() => {
      toast({ title: "Insumo Agregado" })
      setIsAddingItem(false)
    }).finally(() => setIsProcessing(false))
  }

  const isLoadingTotal = isUserLoading || isInventoryLoading || isRequestsLoading

  if (isTech) {
    const myStock = getFieldStockForTech(profile?.username || "")
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Mi Stock en Posesión</h1>
          <p className="text-muted-foreground font-medium">Materiales reportados como stock y herramientas bajo tu custodia.</p>
        </div>

        <Card className="shadow-md border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" /> Listado de Materiales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {myStock.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground italic">No tienes materiales en stock actualmente.</div>
            ) : (
              <Table>
                <TableHeader><TableRow className="bg-muted/30">
                  <TableHead className="font-black uppercase text-[10px]">Descripción</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px]">Cantidad</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Valor Unitario</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {myStock.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-bold uppercase text-xs">{item.description}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-orange-500">{item.quantity} {item.unit}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs">${item.unitValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-xs font-bold uppercase">
          <Info className="h-5 w-5" />
          Recuerda devolver a la bodega física los materiales que ya no necesites para liberar tu responsabilidad.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Gestión de Inventario</h1>
          <p className="text-muted-foreground font-medium">Control de existencias en bodega y stock asignado a técnicos.</p>
        </div>
        <Button className="gap-2 shadow-lg h-12 font-black" onClick={() => setIsAddingItem(true)}>
          <Plus className="h-5 w-5" /> CARGAR NUEVO INSUMO
        </Button>
      </div>

      <Tabs defaultValue="bodega" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="bodega" className="font-bold gap-2"><Warehouse className="h-4 w-4" /> Bodega Central</TabsTrigger>
          <TabsTrigger value="tecnicos" className="font-bold gap-2"><Users className="h-4 w-4" /> Stock por Técnico</TabsTrigger>
        </TabsList>

        <TabsContent value="bodega" className="space-y-6">
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-slate-50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Existencias RYS</CardTitle>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9 h-9 text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/30">
                  <TableHead className="font-black uppercase text-[10px]">Descripción</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px]">Cantidad</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">V. Unitario</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={3} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : (inventoryItems || []).filter(i => i.description.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-slate-700 uppercase text-xs">{item.description}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="font-black">{item.quantity} und</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs">${item.unitValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tecnicos">
          <div className="grid gap-6 md:grid-cols-2">
            {allTechnicians.map((tech) => {
              const techId = tech.id || tech.username
              const fieldStock = getFieldStockForTech(techId)
              return (
                <Card key={techId} className="border-l-4 border-l-orange-500 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 bg-orange-50/30 border-b">
                    <CardTitle className="text-sm font-black uppercase">{tech.name || `${tech.firstName} ${tech.lastName}`}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {fieldStock.length === 0 ? (
                      <div className="p-6 text-center text-[10px] text-slate-300 font-black uppercase">Sin stock</div>
                    ) : fieldStock.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase">{item.description}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} {item.unit}</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 gap-2 font-black text-[9px] uppercase border-primary text-primary"
                          onClick={() => handleReturnToWarehouse(techId, item.description, item.quantity, item.unitValue)}
                          disabled={isProcessing}
                        >
                          <RotateCcw className="h-3 w-3" /> DEVOLVER A BODEGA
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Entrada de Mercancía</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Descripción</Label>
                <Input id="description" name="description" placeholder="EJ: CEMENTO BLANCO 1KG" required className="font-bold uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Cantidad</Label>
                  <Input id="quantity" name="quantity" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">V. Unitario (Costo)</Label>
                  <Input id="unitValue" name="unitValue" type="number" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 w-full bg-green-600 hover:bg-green-700">
                REGISTRAR ENTRADA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
