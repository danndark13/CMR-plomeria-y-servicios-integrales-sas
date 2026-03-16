
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
  PackageCheck
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { ServiceRequest, Expense } from "@/lib/types"

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

  // 2. Fetch Technicians
  const techsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: allUsers } = useCollection(techsQuery)
  const technicians = allUsers?.filter(u => u.roleId === 'Técnico') || []

  // 3. Fetch Service Requests to calculate "Field Stock" (isUnused items)
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: allRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  // Calculate Field Stock per Technician
  const getFieldStockForTech = (techId: string) => {
    if (!allRequests) return []
    
    const unusedExpenses: Expense[] = []
    
    allRequests.forEach((req: ServiceRequest) => {
      (req.interventions || []).forEach(interv => {
        if (interv.technicianId === techId) {
          (interv.detailedExpenses || []).forEach(exp => {
            if (exp.isUnused) {
              unusedExpenses.push(exp)
            }
          })
        }
      })
    })

    // Group by description
    const grouped = unusedExpenses.reduce((acc, exp) => {
      const key = exp.description.toUpperCase()
      if (!acc[key]) {
        acc[key] = { description: key, quantity: 0, unit: exp.unit || 'UND' }
      }
      acc[key].quantity += (exp.quantity || 1)
      return acc
    }, {} as Record<string, { description: string, quantity: number, unit: string }>)

    return Object.values(grouped)
  }

  const filteredItems = inventoryItems?.filter(item => 
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

    const colRef = collection(db, "inventory")
    addDoc(colRef, newItem)
      .then(() => {
        toast({ title: "Insumo Agregado", description: "El stock de bodega ha sido actualizado." })
        setIsAddingItem(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: newItem,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  const totalValue = inventoryItems?.reduce((sum, item) => sum + (item.quantity * item.unitValue), 0) || 0
  const isLoadingTotal = isUserLoading || isInventoryLoading || isRequestsLoading

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Gestión de Inventario</h1>
          <p className="text-muted-foreground font-medium">Control de existencias en bodega y stock asignado a técnicos.</p>
        </div>
        <Button className="gap-2 shadow-lg h-12 font-bold" onClick={() => setIsAddingItem(true)}>
          <Plus className="h-5 w-5" /> Cargar Nuevo Insumo
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Insumos en Bodega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{inventoryItems?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Valorización de Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">${totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-sm bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Materiales en Campo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">{technicians.length} Técnicos</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bodega" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="bodega" className="font-bold gap-2">
            <Warehouse className="h-4 w-4" /> Bodega Central
          </TabsTrigger>
          <TabsTrigger value="tecnicos" className="font-bold gap-2">
            <Users className="h-4 w-4" /> Stock por Técnico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bodega" className="space-y-6">
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-slate-50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" /> Existencias en Bodega RYS
                </CardTitle>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar insumo..." 
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">Descripción del Material</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px]">Cantidad</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">V. Unitario</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">V. Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                        <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronizando bodega...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredItems?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-slate-200 mb-2" />
                        <p className="text-sm font-bold text-slate-400 italic">No hay registros que coincidan con la búsqueda.</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredItems?.map((item) => (
                    <TableRow key={item.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-bold text-slate-700 uppercase text-xs">{item.description}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-black border-primary/20 text-primary">
                          {item.quantity} und
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-500">
                        ${item.unitValue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-800">
                        ${(item.quantity * item.unitValue).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tecnicos">
          <div className="grid gap-6 md:grid-cols-2">
            {technicians.map((tech) => {
              const fieldStock = getFieldStockForTech(tech.id)
              
              return (
                <Card key={tech.id} className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                          <Users className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-black uppercase">{tech.firstName} {tech.lastName}</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-tighter">ID: {tech.username}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mt-2">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 border-b pb-1">
                        <PackageCheck className="h-3 w-3 text-orange-600" /> Materiales en Posesión (Sobrantes de Obra)
                      </p>
                      <div className="grid gap-2">
                        {fieldStock.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-lg border border-dashed text-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase italic">Sin materiales registrados en campo</span>
                          </div>
                        ) : fieldStock.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                            <span className="text-xs font-black uppercase text-slate-700">{item.description}</span>
                            <Badge className="bg-orange-500 text-white font-black">
                              {item.quantity} {item.unit}
                            </Badge>
                          </div>
                        ))}
                      </div>
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
            <DialogDescription>Ingrese los detalles del nuevo material para la bodega central.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Descripción del Material</Label>
                <Input id="description" name="description" placeholder="EJ: CEMENTO BLANCO 1KG" required className="font-bold uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Cantidad Inicial</Label>
                  <Input id="quantity" name="quantity" type="number" placeholder="10" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Valor Unitario (Costo)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input id="unitValue" name="unitValue" type="number" placeholder="5000" required className="pl-7" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddingItem(false)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} REGISTRAR ENTRADA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
