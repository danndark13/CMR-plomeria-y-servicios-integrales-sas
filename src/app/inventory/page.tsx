
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
  RotateCcw
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
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

  // 1. Fetch Warehouse Inventory
  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "inventory")
  }, [db, user])
  const { data: inventoryItems, isLoading: isInventoryLoading } = useCollection(inventoryQuery)

  // 2. Fetch Technicians from Firestore
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: firestoreUsers } = useCollection(usersQuery)

  // 3. Fetch Service Requests to calculate "Field Stock" (isUnused items)
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

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

  // Calcular Stock en Campo por Técnico
  const getFieldStockForTech = (techId: string) => {
    const unusedExpenses: Expense[] = []
    
    allRequests.forEach((req: ServiceRequest) => {
      (req.interventions || []).forEach(interv => {
        if (interv.technicianId === techId) {
          (interv.detailedExpenses || []).forEach(exp => {
            // Un material está en stock si isUnused es true y NO ha sido devuelto
            if (exp.isUnused === true && !exp.isReturned) {
              unusedExpenses.push(exp)
            }
          })
        }
      })
    })

    // Agrupar por descripción
    const grouped = unusedExpenses.reduce((acc, exp) => {
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

      // 1. Mark items as returned in service requests
      for (const req of allRequests) {
        if (remainingToProcess <= 0) break

        const updatedInterventions = (req.interventions || []).map(interv => {
          if (interv.technicianId !== techId) return interv

          const updatedExpenses = (interv.detailedExpenses || []).map(exp => {
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

      // 2. Add to Warehouse Inventory
      const existingItem = (inventoryItems || []).find(i => i.description.toUpperCase().trim() === itemDescription.toUpperCase().trim())
      if (existingItem) {
        batch.update(doc(db, "inventory", existingItem.id), {
          quantity: existingItem.quantity + quantityToReturn,
          updatedAt: serverTimestamp()
        })
      } else {
        const newItemRef = doc(collection(db, "inventory"))
        batch.set(newItemRef, {
          description: itemDescription.toUpperCase().trim(),
          quantity: quantityToReturn,
          unitValue: unitValue,
          updatedAt: serverTimestamp(),
          lastModifiedBy: user?.uid || "SISTEMA"
        })
      }

      await batch.commit()
      toast({ title: "Retorno Procesado", description: `${quantityToReturn} unidades de ${itemDescription} devueltas a bodega.` })
    } catch (error) {
      console.error("Error returning items:", error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la devolución." })
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredItems = (inventoryItems || []).filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

    addDoc(collection(db, "inventory"), newItem)
      .then(() => {
        toast({ title: "Insumo Agregado" })
        setIsAddingItem(false)
      })
      .finally(() => setIsProcessing(false))
  }

  const totalValue = (inventoryItems || []).reduce((sum, item) => sum + (item.quantity * item.unitValue), 0) || 0
  const isLoadingTotal = isUserLoading || isInventoryLoading || isRequestsLoading

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Gestión de Inventario</h1>
          <p className="text-muted-foreground font-medium">Control de existencias en bodega y stock asignado a técnicos (Sobrantes de obra).</p>
        </div>
        <Button className="gap-2 shadow-lg h-12 font-black bg-primary hover:bg-primary/90" onClick={() => setIsAddingItem(true)}>
          <Plus className="h-5 w-5" /> CARGAR NUEVO INSUMO
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Insumos en Bodega</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{inventoryItems?.length || 0}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Valorización Bodega</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-black text-green-600">${totalValue.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-sm bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Técnicos con Stock</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-black text-orange-600">{allTechnicians.length} Equipos</div></CardContent>
        </Card>
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
                  <Input placeholder="Buscar insumo..." className="pl-9 h-9 text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/30">
                  <TableHead className="font-black uppercase text-[10px]">Descripción</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px]">Cantidad</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">V. Unitario</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">V. Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><p className="text-sm font-bold text-slate-400 italic">No hay registros.</p></TableCell></TableRow>
                  ) : filteredItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-bold text-slate-700 uppercase text-xs">{item.description}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="font-black border-primary/20 text-primary">{item.quantity} und</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-500">${item.unitValue.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-800">${(item.quantity * item.unitValue).toLocaleString()}</TableCell>
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
              const techName = tech.name || `${tech.firstName} ${tech.lastName}`
              
              return (
                <Card key={techId} className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <CardHeader className="pb-2 bg-orange-50/30 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600"><Users className="h-6 w-6" /></div>
                        <div>
                          <CardTitle className="text-sm font-black uppercase">{techName}</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase">Custodia de Materiales</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-0">
                      {fieldStock.length === 0 ? (
                        <div className="p-10 text-center">
                          <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Sin materiales en stock de campo</span>
                        </div>
                      ) : fieldStock.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-slate-700">{item.description}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} {item.unit} x ${item.unitValue.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className="bg-orange-500 text-white font-black text-[10px]">{item.quantity} {item.unit}</Badge>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 gap-2 font-black text-[9px] uppercase border-primary text-primary hover:bg-primary hover:text-white"
                              onClick={() => handleReturnToWarehouse(techId, item.description, item.quantity, item.unitValue)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} DEVOLVER A BODEGA
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
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
            <DialogDescription>Detalles del nuevo material para bodega central.</DialogDescription>
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
                  <Input id="quantity" name="quantity" type="number" placeholder="10" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">V. Unitario (Costo)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input id="unitValue" name="unitValue" type="number" placeholder="5000" required className="pl-7" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddingItem(false)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 bg-green-600 hover:bg-green-700">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} REGISTRAR ENTRADA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
