
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileText, 
  Plus, 
  Search, 
  Trash2, 
  Save, 
  ArrowLeft, 
  Printer, 
  Loader2,
  ChevronRight,
  History,
  Building2,
  User,
  CreditCard
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useUser, useMemoFirebase } from "@/firebase"
import { collection, addDoc, query, orderBy, serverTimestamp } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { PaymentAccount, QuoteItem } from "@/lib/types"
import { convertNumberToSpanishWords } from "@/lib/numbers-to-words"
import Link from "next/link"

export default function PaymentAccountsPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    type: 'company' as 'natural' | 'company',
    issuerName: "PLOMERÍA Y SERVICIOS INTEGRALES RYS SAS",
    issuerId: "901.123.456-7",
    issuerPhone: "310 000 0000",
    issuerAddress: "Calle Falsa 123, Bogotá",
    bankName: "",
    accountType: "ahorros" as "ahorros" | "corriente",
    accountNumber: "",
    clientName: "",
    clientDetails: "",
    reference: `CC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
  })
  
  const [items, setItems] = useState<Partial<QuoteItem>[]>([
    { id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, total: 0 }
  ])

  // Firestore Data
  const accountsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "payment_accounts"), orderBy("createdAt", "desc"))
  }, [db])
  const { data: accounts, isLoading } = useCollection(accountsQuery)

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

  const total = items.reduce((sum, item) => sum + (item.total || 0), 0)
  const totalInWords = convertNumberToSpanishWords(total)

  const handleCreateAccount = async () => {
    if (!db || !user) return
    if (!formData.clientName || items.some(i => !i.description)) {
      toast({ title: "Error", description: "Complete los campos obligatorios.", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      const newAccount: Omit<PaymentAccount, 'id'> = {
        ...formData,
        date: new Date().toISOString(),
        items: items as QuoteItem[],
        total,
        totalInWords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await addDoc(collection(db, "payment_accounts"), {
        ...newAccount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      toast({ title: "Éxito", description: "Cuenta de cobro guardada correctamente." })
      setIsCreating(false)
      // Reset form (keep issuer data)
      setFormData(prev => ({
        ...prev,
        clientName: "",
        clientDetails: "",
        reference: `CC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
      }))
      setItems([{ id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, total: 0 }])
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "No se pudo guardar el documento.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredAccounts = (accounts || []).filter(a => 
    (a.reference || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.clientName.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Cuentas de Cobro</h1>
            <p className="text-muted-foreground font-medium">Generación de cuentas para personas y empresas.</p>
          </div>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700 font-bold shadow-lg h-12">
              <Plus className="h-5 w-5" /> Nueva Cuenta de Cobro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Generar Cuenta de Cobro</DialogTitle>
              <DialogDescription>Documento formal de cobro de servicios.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex gap-4 p-1 bg-slate-100 rounded-lg w-fit">
                <Button 
                  variant={formData.type === 'company' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setFormData({...formData, type: 'company'})}
                  className="gap-2 font-bold text-[10px] uppercase"
                >
                  <Building2 className="h-3 w-3" /> Empresa
                </Button>
                <Button 
                  variant={formData.type === 'natural' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setFormData({...formData, type: 'natural'})}
                  className="gap-2 font-bold text-[10px] uppercase"
                >
                  <User className="h-3 w-3" /> Persona Natural
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-dashed">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary border-b pb-1">Datos del Emisor</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase">Nombre / Razón Social</Label>
                      <Input value={formData.issuerName} onChange={e => setFormData({...formData, issuerName: e.target.value})} className="h-8 text-xs font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase">NIT / CC</Label>
                        <Input value={formData.issuerId} onChange={e => setFormData({...formData, issuerId: e.target.value})} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase">Teléfono</Label>
                        <Input value={formData.issuerPhone} onChange={e => setFormData({...formData, issuerPhone: e.target.value})} className="h-8 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-purple-600 border-b pb-1">Información Bancaria</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase">Banco</Label>
                      <Input value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} placeholder="Banco X" className="h-8 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase">Tipo Cuenta</Label>
                        <Select value={formData.accountType} onValueChange={(v: any) => setFormData({...formData, accountType: v})}>
                          <SelectTrigger className="h-8 text-xs uppercase font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ahorros">Ahorros</SelectItem>
                            <SelectItem value="corriente">Corriente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase">N° Cuenta</Label>
                        <Input value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} className="h-8 text-xs font-mono" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600">Cobrar a (Cliente)</Label>
                  <Input value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} placeholder="Ej: Allianz Seguros" className="font-bold border-blue-100" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Referencia Documento</Label>
                  <Input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} className="font-mono text-xs" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                   Conceptos del Cobro
                </h3>
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7 space-y-1">
                      <Label className="text-[8px] font-black uppercase">Descripción del Servicio</Label>
                      <Input value={item.description} onChange={e => updateItem(item.id!, 'description', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[8px] font-black uppercase">Cant.</Label>
                      <Input type="number" value={item.quantity} onChange={e => updateItem(item.id!, 'quantity', Number(e.target.value))} className="h-8 text-xs font-bold" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[8px] font-black uppercase">V. Unitario</Label>
                      <Input type="number" value={item.unitPrice} onChange={e => updateItem(item.id!, 'unitPrice', Number(e.target.value))} className="h-8 text-xs font-bold" />
                    </div>
                    <div className="col-span-1 text-right pb-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id!)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed border-2"><Plus className="h-4 w-4 mr-2" /> Agregar Concepto</Button>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-xl space-y-4 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <CreditCard className="h-20 w-20" />
                </div>
                <div className="relative z-10 flex justify-between items-center">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Total a Cobrar</h4>
                    <p className="text-4xl font-black text-white">$ {total.toLocaleString()}</p>
                  </div>
                  <div className="text-right max-w-[60%]">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Valor en Letras</h4>
                    <p className="text-[11px] font-bold uppercase italic leading-tight text-white/90">
                      {totalInWords}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setIsCreating(false)}>CANCELAR</Button>
              <Button onClick={handleCreateAccount} disabled={isSaving} className="bg-green-600 hover:bg-green-700 font-black h-12 shadow-lg gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} GUARDAR DOCUMENTO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por cliente o referencia..." 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-t-4 border-t-purple-500 shadow-xl">
        <CardHeader className="bg-slate-50/80 border-b">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
            <History className="h-4 w-4 text-purple-500" /> Historial de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px]">TIPO</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Referencia</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Cliente</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Total</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic">No se encontraron documentos.</TableCell></TableRow>
              ) : filteredAccounts.map((acc) => (
                <TableRow key={acc.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell>
                    {acc.type === 'natural' ? <Badge variant="outline" className="text-[8px] font-black uppercase border-blue-200 text-blue-700">P. NATURAL</Badge> : <Badge variant="outline" className="text-[8px] font-black uppercase border-purple-200 text-purple-700">EMPRESA</Badge>}
                  </TableCell>
                  <TableCell><span className="font-mono font-black text-primary">{acc.reference || '---'}</span></TableCell>
                  <TableCell><span className="font-bold text-sm uppercase">{acc.clientName}</span></TableCell>
                  <TableCell className="text-xs">{new Date(acc.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono font-black text-slate-800">${acc.total.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                      <Printer className="h-4 w-4" />
                    </Button>
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
