
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Calculator, 
  Plus, 
  Search, 
  Trash2, 
  Save, 
  ArrowLeft, 
  Printer, 
  FileText,
  Loader2,
  ChevronRight,
  Clock,
  CheckCircle2
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useUser, useMemoFirebase } from "@/firebase"
import { collection, doc, addDoc, updateDoc, query, orderBy, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Quote, QuoteItem } from "@/lib/types"
import Link from "next/link"

export default function QuotesPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    reference: `COT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    notes: "",
  })
  const [items, setItems] = useState<Partial<QuoteItem>[]>([
    { id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, total: 0 }
  ])

  // Firestore Data
  const quotesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "quotes"), orderBy("createdAt", "desc"))
  }, [db])
  const { data: quotes, isLoading } = useCollection(quotesQuery)

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, total: 0 }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = (Number(updatedItem.quantity) || 0) * (Number(updatedItem.unitPrice) || 0)
        }
        return updatedItem
      }
      return item
    }))
  }

  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0)
  const tax = subtotal * 0.19 // Default 19% IVA in Colombia if needed, but keeping it simpler for now
  const total = subtotal

  const handleCreateQuote = async () => {
    if (!db || !user) return
    if (!formData.clientName || items.some(i => !i.description)) {
      toast({ title: "Error", description: "Complete todos los campos obligatorios.", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      const newQuote: Omit<Quote, 'id'> = {
        reference: formData.reference,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        date: new Date().toISOString(),
        items: items as QuoteItem[],
        subtotal,
        tax: 0,
        total,
        notes: formData.notes,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await addDoc(collection(db, "quotes"), {
        ...newQuote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Éxito", description: "Cotización guardada correctamente." })
      setIsCreating(false)
      // Reset form
      setFormData({
        reference: `COT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        notes: "",
      })
      setItems([{ id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, total: 0 }])
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "No se pudo guardar la cotización.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredQuotes = (quotes || []).filter(q => 
    q.reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/accounting">
            <Button variant="outline" size="icon" className="rounded-xl border-primary text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Cotizaciones</h1>
            <p className="text-muted-foreground font-medium">Gestión de propuestas comerciales.</p>
          </div>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-orange-600 hover:bg-orange-700 font-bold shadow-lg h-12">
              <Plus className="h-5 w-5" /> Nueva Cotización
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Generar Cotización</DialogTitle>
              <DialogDescription>Cree una nueva propuesta formal para un cliente.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Referencia</Label>
                  <Input 
                    value={formData.reference} 
                    onChange={e => setFormData({...formData, reference: e.target.value})}
                    placeholder="COT-2024-001" 
                    className="font-bold border-orange-100 focus:border-orange-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Nombre del Cliente</Label>
                  <Input 
                    value={formData.clientName}
                    onChange={e => setFormData({...formData, clientName: e.target.value})}
                    placeholder="Nombre Completo / Empresa" 
                    className="font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Email</Label>
                  <Input 
                    value={formData.clientEmail}
                    onChange={e => setFormData({...formData, clientEmail: e.target.value})}
                    placeholder="correo@ejemplo.com" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                  <Input 
                    value={formData.clientPhone}
                    onChange={e => setFormData({...formData, clientPhone: e.target.value})}
                    placeholder="300 123 4567" 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest border-b pb-2">Conceptos</h3>
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6 space-y-1">
                      <Label className="text-[8px] font-black uppercase">Descripción</Label>
                      <Input 
                        value={item.description}
                        onChange={e => updateItem(item.id!, 'description', e.target.value)}
                        placeholder="Descripción del servicio/producto" 
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[8px] font-black uppercase">Cant.</Label>
                      <Input 
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(item.id!, 'quantity', e.target.value)}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[8px] font-black uppercase">V. Unitario</Label>
                      <Input 
                        type="number"
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id!, 'unitPrice', e.target.value)}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                    <div className="col-span-1 text-right pb-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => removeItem(item.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed border-2">
                  <Plus className="h-4 w-4 mr-2" /> Agregar Item
                </Button>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <div className="w-48 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Subtotal:</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black border-t pt-2 text-primary">
                    <span>TOTAL:</span>
                    <span>${total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Notas Adicionales</Label>
                <Textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Validez de la oferta, tiempos de entrega, etc." 
                  className="text-xs" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>CANCELAR</Button>
              <Button onClick={handleCreateQuote} disabled={isSaving} className="bg-green-600 hover:bg-green-700 font-black h-12 shadow-lg gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} GUARDAR COTIZACIÓN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por referencia o cliente..." 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-t-4 border-t-orange-500 shadow-xl">
        <CardHeader className="bg-slate-50/80 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
              <Clock className="h-4 w-4 text-orange-500" /> Historial de Cotizaciones
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px]">Referencia</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Cliente</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Total</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px]">Estado</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredQuotes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic">No se encontraron cotizaciones.</TableCell></TableRow>
              ) : filteredQuotes.map((quote) => (
                <TableRow key={quote.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell><span className="font-mono font-black text-primary">{quote.reference}</span></TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm uppercase">{quote.clientName}</span>
                      <span className="text-[9px] text-muted-foreground">{quote.clientEmail || 'Sin email'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{new Date(quote.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono font-black text-slate-800">${quote.total.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[9px] font-black uppercase">
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
