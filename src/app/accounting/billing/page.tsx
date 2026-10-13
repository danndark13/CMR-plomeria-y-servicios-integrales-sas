
"use client"

import { ChangeEvent, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Receipt, 
  Search, 
  FileSpreadsheet,
  Building2,
  ChevronRight,
  ArrowLeft,
  FileText,
  Loader2,
  Calculator,
  Save,
  Clock,
  Briefcase,
  DollarSign,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Upload,
  AlertTriangle
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, DocumentData, updateDoc, writeBatch } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ServiceRequest, BillingStatus } from "@/lib/types"

export default function BillingReportPage() {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [validatingRequest, setValidatingRequest] = useState<ServiceRequest | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paidInvoicePreview, setPaidInvoicePreview] = useState<Array<Record<string, string | number>> | null>(null)
  const [paidInvoiceErrors, setPaidInvoiceErrors] = useState<string[]>([])
  const [paidInvoiceMessage, setPaidInvoiceMessage] = useState("")

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])

  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "assistance_companies")
  }, [db, user])
  const { data: firestoreCompanies } = useCollection(companiesQuery)
  const allCompanies = useMemo(() => {
    const companies = [...(firestoreCompanies || [])]
    MOCK_COMPANIES.forEach(mock => {
      if (!companies.some(company => company.id === mock.id)) companies.push(mock)
    })
    return companies
  }, [firestoreCompanies])

  const allRequests = firestoreRequests ? [...firestoreRequests, ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.claimNumber === mr.claimNumber))] : MOCK_REQUESTS

  const selectedCompany = allCompanies.find(c => c.id === selectedCompanyId)

  const filteredRequests = allRequests.filter(req => {
    const matchesCompany = !selectedCompanyId || req.companyId === selectedCompanyId
    const matchesSearch = (req.claimNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (req.insuredName || "").toLowerCase().includes(searchTerm.toLowerCase())
    const isCompleted = req.status === 'completed'
    return matchesCompany && matchesSearch && isCompleted
  })

  // CATEGORÍAS DE FACTURACIÓN
  const pendingRequests = filteredRequests.filter(r => r.billingStatus === 'pending' || !r.billingStatus)
  const preValidatedRequests = filteredRequests.filter(r => r.billingStatus === 'pre_validated')
  const validatedRequests = filteredRequests.filter(r => r.billingStatus === 'validated' || r.billingStatus === 'paid')

  // Group validated requests by Invoice Number
  const groupedByInvoice = validatedRequests.reduce((acc, req) => {
    const inv = req.invoiceNumber || "SIN_FACTURA"
    if (!acc[inv]) acc[inv] = []
    acc[inv].push(req)
    return acc
  }, {} as Record<string, ServiceRequest[]>)

  const handleSetPreValidated = (requestId: string) => {
    if (!db) return
    setIsProcessing(true)
    const docRef = doc(db, "service_requests", requestId)
    updateDoc(docRef, { billingStatus: 'pre_validated' as BillingStatus, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Prevalidado", description: "Expediente listo para facturar." }))
      .finally(() => setIsProcessing(false))
  }

  const handleValidateBilling = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !validatingRequest) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const invoiceNumber = (formData.get("invoiceNumber") as string).toUpperCase()
    const billingConsecutive = (formData.get("billingConsecutive") as string).toUpperCase()
    const approvedAmount = Number(formData.get("approvedAmount"))
    const accountingNotes = formData.get("accountingNotes") as string

    const docRef = doc(db, "service_requests", validatingRequest.id)
    const updatedData = {
      billingStatus: 'validated' as BillingStatus,
      invoiceNumber,
      billingConsecutive,
      approvedAmount,
      accountingNotes,
      updatedAt: new Date().toISOString()
    }

    updateDoc(docRef, updatedData)
      .then(() => {
        toast({ title: "Conciliación Exitosa", description: `Expediente ${validatingRequest.claimNumber} validado correctamente.` })
        setValidatingRequest(null)
      })
      .finally(() => setIsProcessing(false))
  }

  const calculateSuggested = (req: ServiceRequest) => {
    return (req.interventions || []).reduce((s, i) => s + (i.reportedValue || 0), 0)
  }

  const downloadPaidInvoicesTemplate = () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[
      "expediente", "asistencia", "cuenta", "servicios", "valor_pagado", "orden_de_compra", "factura_electronica", "consecutivo", "fecha"
    ]]), "Facturas pagadas")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Columna", "Instrucciones"],
      ["expediente", "Obligatorio; debe coincidir con un expediente existente en Firestore."],
      ["asistencia", "Asistencia existente (nombre o ID)."],
      ["cuenta", "Cuenta que pagó/facturó el servicio."],
      ["servicios", "Descripción de los servicios incluidos en la factura."],
      ["valor_pagado", "Obligatorio; valor total pagado por el servicio del expediente."],
      ["orden_de_compra", "Número de orden de compra."],
      ["factura_electronica", "Número de factura electrónica, obligatorio."],
      ["consecutivo", "Consecutivo de facturación."],
      ["fecha", "Fecha de facturación/pago, obligatoria; formato AAAA-MM-DD o DD/MM/AAAA."]
    ]), "Instrucciones")
    XLSX.writeFile(workbook, "Plantilla_expedientes_facturados_pagados.xlsx")
  }

  const parsePaidInvoiceWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setIsProcessing(true)
    setPaidInvoicePreview(null)
    setPaidInvoiceErrors([])
    setPaidInvoiceMessage("")
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error("El archivo no contiene hojas.")
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" })
      const seen = new Set<string>()
      const errors: string[] = []
      const valid: Array<Record<string, string | number>> = []
      const normalized = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      const parseAmount = (value: unknown) => {
        if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN
        const raw = String(value ?? "").trim().replace(/[^\d,.-]/g, "")
        if (!raw) return Number.NaN
        const comma = raw.lastIndexOf(",")
        const dot = raw.lastIndexOf(".")
        let numeric = raw
        if (comma >= 0 && dot >= 0) {
          const decimalSeparator = comma > dot ? "," : "."
          const thousandsSeparator = decimalSeparator === "," ? "." : ","
          numeric = raw.split(thousandsSeparator).join("")
          if (decimalSeparator === ",") numeric = numeric.replace(",", ".")
        } else if (comma >= 0 || dot >= 0) {
          const separator = comma >= 0 ? "," : "."
          const parts = raw.split(separator)
          numeric = parts.length > 2 || parts[parts.length - 1].length === 3
            ? parts.join("")
            : raw.replace(separator, ".")
        }
        return Number(numeric)
      }
      const companies = new Map(allCompanies.flatMap(company => [
        [normalized(company.name), company.id] as const,
        [normalized(company.id), company.id] as const
      ]))
      rows.forEach((row, index) => {
        const values = new Map(Object.entries(row).map(([key, value]) => [normalized(key).replace(/[^\w]+/g, "_").replace(/^_|_$/g, ""), value]))
        const get = (...keys: string[]) => {
          for (const key of keys) {
            const value = values.get(key)
            if (value !== undefined && String(value).trim()) return String(value).trim()
          }
          return ""
        }
        const claimNumber = get("expediente", "claimnumber", "claim_number").toUpperCase()
        const invoiceNumber = get("factura_electronica", "factura", "invoice", "invoicenumber").toUpperCase()
        const invoiceAmount = parseAmount(get("valor_pagado", "valor_pagado_por_ese_servicio", "valor_pagado_factura", "valor_factura", "monto_pagado", "invoice_amount", "paid_amount", "amount"))
        const rawDate = values.get("fecha")
        const companyRaw = get("asistencia", "company", "empresa")
        const companyId = companyRaw
          ? companies.get(normalized(companyRaw)) || allCompanies.find(company => {
            const name = normalized(company.name)
            const id = normalized(company.id)
            const raw = normalized(companyRaw)
            return name.startsWith(raw) || raw.startsWith(name) || id === raw
          })?.id
          : undefined
        let invoiceDate = ""
        if (typeof rawDate === "number" && Number.isFinite(rawDate)) {
          const dateParts = XLSX.SSF.parse_date_code(rawDate)
          if (dateParts) invoiceDate = `${dateParts.y}-${String(dateParts.m).padStart(2, "0")}-${String(dateParts.d).padStart(2, "0")}`
        } else if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
          invoiceDate = rawDate.toISOString().slice(0, 10)
        } else if (rawDate !== undefined && String(rawDate).trim()) {
          const dateText = String(rawDate).trim()
          const matchedDate = dateText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
          if (matchedDate) invoiceDate = `${matchedDate[3]}-${matchedDate[2].padStart(2, "0")}-${matchedDate[1].padStart(2, "0")}`
          else if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) invoiceDate = dateText
          else {
            const parsed = new Date(dateText)
            if (!Number.isNaN(parsed.getTime())) invoiceDate = parsed.toISOString().slice(0, 10)
          }
        }
        if (invoiceDate) {
          const parsedDate = new Date(`${invoiceDate}T00:00:00.000Z`)
          if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== invoiceDate) invoiceDate = ""
        }
        if (!claimNumber || !invoiceNumber || !invoiceDate || !Number.isFinite(invoiceAmount) || invoiceAmount <= 0 || (companyRaw && !companyId)) {
          errors.push(`Fila ${index + 2}: expediente, factura electrónica, valor pagado mayor que cero y fecha válida son obligatorios; verifica también la asistencia.`)
          return
        }
        if (seen.has(claimNumber)) {
          errors.push(`Fila ${index + 2}: el expediente ${claimNumber} está repetido en el archivo.`)
          return
        }
        seen.add(claimNumber)
        const existing = firestoreRequests?.find(request => request.claimNumber.trim().toUpperCase() === claimNumber)
        if (!existing) {
          errors.push(`Fila ${index + 2}: no existe el expediente ${claimNumber} en Firestore; no se creará ningún registro.`)
          return
        }
        valid.push({
          id: existing.id,
          claimNumber,
          invoiceNumber,
          invoiceAmount,
          invoiceServices: get("servicios", "servicio", "services", "service"),
          purchaseOrder: get("orden_de_compra", "orden_compra", "purchaseorder", "purchase_order"),
          billingConsecutive: get("consecutivo", "billingconsecutive").toUpperCase(),
          invoiceDate,
          paidAt: invoiceDate,
          ...(companyId ? { companyId } : {}),
          accountName: get("cuenta", "account", "accountname")
        })
      })
      if (!rows.length) throw new Error("La hoja no contiene filas.")
      if (valid.length > 450) throw new Error("Carga hasta 450 facturas por archivo para guardar cada lote de forma segura.")
      setPaidInvoicePreview(valid.length ? valid : null)
      setPaidInvoiceErrors(errors)
      setPaidInvoiceMessage(`${valid.length} facturas coinciden con expedientes existentes y están listas para revisar.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el archivo."
      setPaidInvoiceMessage(message)
      toast({ variant: "destructive", title: "Error en la planilla", description: message })
    } finally {
      setIsProcessing(false)
    }
  }

  const importPaidInvoices = async () => {
    if (!db || !paidInvoicePreview?.length) return
    setIsProcessing(true)
    try {
      const batch = writeBatch(db)
      const now = new Date().toISOString()
      paidInvoicePreview.forEach(item => {
        const request = firestoreRequests?.find(existing => existing.id === String(item.id))
        const updates: DocumentData = {
          invoiceNumber: String(item.invoiceNumber),
          invoiceAmount: Number(item.invoiceAmount),
          approvedAmount: Number(item.invoiceAmount),
          billingStatus: "validated",
          status: "completed",
          updatedAt: now
        }
        for (const key of ["billingConsecutive", "companyId", "accountName", "purchaseOrder", "invoiceServices", "invoiceDate", "paidAt"] as const) {
          const value = item[key]
          if (value !== undefined && value !== "") updates[key] = value
        }
        if (request && request.status !== "completed") {
          updates.statusHistory = [...(request.statusHistory || []), { status: "completed", date: now }]
        }
        batch.update(doc(db, "service_requests", String(item.id)), updates)
      })
      await batch.commit()
      const summary = `${paidInvoicePreview.length} expedientes validados con el valor pagado, fecha, factura y orden de compra. Reportes e intervenciones no fueron modificados.`
      setPaidInvoiceMessage(summary)
      setPaidInvoicePreview(null)
      toast({ title: "Conciliación masiva completada", description: summary })
    } catch (error) {
      console.error("Bulk paid invoice import failed:", error)
      toast({ variant: "destructive", title: "No se completó la carga", description: error instanceof Error ? error.message : "Verifica permisos y conexión con Firestore." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportExcel = () => {
    if (!selectedCompany) return
    
    const titleRow = ["PLOMERÍA Y SERVICIOS INTEGRALES RYS SAS", "", "", "", ""]
    const headers = ["EXPEDIENTE", "ASEGURADO", "CUENTA", "TIPO DE SERVICIO", "VALOR SUGERIDO (BRUTO REPORTADO)"]
    
    const rows = preValidatedRequests.map(req => [
      req.claimNumber,
      req.insuredName.toUpperCase(),
      req.accountName.toUpperCase(),
      req.category.toUpperCase(),
      calculateSuggested(req)
    ])

    const csvContent = [
      titleRow.join(","),
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Prevalidado_${selectedCompany.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    toast({ title: "Excel Generado", description: "Reporte de prevalidado descargado." })
  }

  const isLoadingTotal = isUserLoading || isRequestsLoading

  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Módulo Contable: Facturación</h1>
          <p className="text-muted-foreground font-medium">Seleccione una aseguradora para procesar conciliaciones y facturas de forma independiente.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {MOCK_COMPANIES.map((company) => {
            const companyRequests = allRequests.filter(r => r.companyId === company.id && r.status === 'completed')
            const pendingCount = companyRequests.filter(r => r.billingStatus !== 'validated').length
            
            return (
              <Card 
                key={company.id} 
                className="hover:shadow-xl transition-all cursor-pointer group border-l-4 border-l-primary"
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <CardHeader className="pb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg uppercase font-black">{company.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span className="font-bold text-primary">{pendingCount}</span> por conciliar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full justify-between text-xs font-bold p-0 group-hover:text-primary">
                    Gestionar Cartera <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedCompanyId(null)} className="rounded-xl border-primary text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">{selectedCompany?.name || 'Facturación'}</h1>
            <p className="text-muted-foreground font-medium">Gestión de cartera independiente.</p>
          </div>
        </div>
        <Button onClick={handleExportExcel} className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg h-12">
          <FileSpreadsheet className="h-5 w-5" /> Exportar Excel Prevalidado
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar expediente..." 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-primary" /> Cargar facturas ya pagadas</CardTitle>
          <CardDescription>Solo concilia expedientes existentes. Actualiza el estado de facturación y los campos diligenciados; no modifica reportes, intervenciones ni datos operativos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={downloadPaidInvoicesTemplate}><Download className="h-4 w-4" /> Descargar plantilla</Button>
            <Button type="button" variant="outline" className="gap-2" asChild disabled={isProcessing || isRequestsLoading}>
              <label><FileSpreadsheet className="h-4 w-4" /> Seleccionar Excel<input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={parsePaidInvoiceWorkbook} disabled={isProcessing || isRequestsLoading} /></label>
            </Button>
            {paidInvoicePreview && <Button type="button" onClick={importPaidInvoices} disabled={isProcessing || isRequestsLoading || !firestoreRequests}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmar carga ({paidInvoicePreview.length})</Button>}
            {paidInvoicePreview && <Button type="button" variant="ghost" onClick={() => setPaidInvoicePreview(null)} disabled={isProcessing}>Cancelar</Button>}
          </div>
          {paidInvoiceMessage && <p className="text-sm font-medium text-muted-foreground">{paidInvoiceMessage}</p>}
          {paidInvoiceErrors.length > 0 && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Filas no importadas</p><ul className="list-inside list-disc">{paidInvoiceErrors.slice(0, 10).map(error => <li key={error}>{error}</li>)}</ul>{paidInvoiceErrors.length > 10 && <p className="mt-1">Y {paidInvoiceErrors.length - 10} errores más.</p>}</div>}
          {paidInvoicePreview && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50"><tr><th className="p-2">Expediente</th><th className="p-2">Asistencia</th><th className="p-2">Factura</th><th className="p-2">Valor pagado</th><th className="p-2">Orden de compra</th><th className="p-2">Servicios</th><th className="p-2">Fecha</th></tr></thead>
                <tbody>{paidInvoicePreview.slice(0, 20).map(item => <tr key={String(item.id)} className="border-t"><td className="p-2 font-bold">{item.claimNumber}</td><td className="p-2">{allCompanies.find(company => company.id === item.companyId)?.name || "Se conserva"}</td><td className="p-2">{item.invoiceNumber}</td><td className="p-2 font-mono">${Number(item.invoiceAmount).toLocaleString("es-CO")}</td><td className="p-2">{item.purchaseOrder || "—"}</td><td className="p-2">{item.invoiceServices || "—"}</td><td className="p-2">{item.invoiceDate}</td></tr>)}</tbody>
              </table>
              {paidInvoicePreview.length > 20 && <p className="p-2 text-xs text-muted-foreground">Mostrando las primeras 20 de {paidInvoicePreview.length} filas.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-6 h-12 bg-slate-100 p-1">
          <TabsTrigger value="pending" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all">
            POR PREVALIDAR
          </TabsTrigger>
          <TabsTrigger value="pre_validated" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            PREVALIDADOS
          </TabsTrigger>
          <TabsTrigger value="facturados" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all">
            FACTURADOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="overflow-hidden border-t-4 border-t-orange-500 shadow-xl">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                <Clock className="h-4 w-4 text-orange-500" /> Expedientes por Revisar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Servicios</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Orden de compra</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Cuenta</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">V. Reportado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : pendingRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No hay expedientes pendientes.</TableCell></TableRow>
                  ) : pendingRequests.map((req) => (
                    <TableRow key={req.id} className="hover:bg-primary/5">
                      <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                      <TableCell><span className="font-bold text-sm uppercase">{req.insuredName}</span></TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-600">${calculateSuggested(req).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="font-black text-[9px] uppercase border-orange-200 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleSetPreValidated(req.id)}
                          disabled={isProcessing}
                        >
                          MARCAR PREVALIDADO
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pre_validated">
          <Card className="overflow-hidden border-t-4 border-t-blue-500 shadow-xl">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                <ClipboardCheck className="h-4 w-4 text-blue-500" /> Listos para Conciliar y Facturar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Costo Sugerido</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : preValidatedRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No hay expedientes prevalidados.</TableCell></TableRow>
                  ) : preValidatedRequests.map((req) => (
                    <TableRow key={req.id} className="hover:bg-primary/5">
                      <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                      <TableCell><span className="font-bold text-sm uppercase">{req.insuredName}</span></TableCell>
                      <TableCell className="text-right font-mono font-black text-blue-600">${calculateSuggested(req).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          className="h-8 font-black text-[10px] uppercase bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setValidatingRequest(req)}
                        >
                          FACTURAR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturados">
          <div className="space-y-8">
            {isLoadingTotal ? (
              <div className="h-60 flex flex-col items-center justify-center gap-4 bg-white rounded-xl border border-dashed">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargando historial...</p>
              </div>
            ) : Object.keys(groupedByInvoice).length === 0 ? (
              <Card className="border-dashed py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Receipt className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-lg font-bold">Sin facturas generadas para esta empresa</p>
              </Card>
            ) : Object.entries(groupedByInvoice).sort((a,b) => b[0].localeCompare(a[0])).map(([invoiceNum, requests]) => {
              const typedRequests = requests as ServiceRequest[]
              const totalFactura = typedRequests.reduce((sum: number, r: ServiceRequest) => sum + (r.approvedAmount ?? r.invoiceAmount ?? 0), 0)
              const firstReq = typedRequests[0]
              
              return (
                <Card key={invoiceNum} className="overflow-hidden border-none shadow-lg group">
                  <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black uppercase tracking-widest">Factura: {invoiceNum}</span>
                          <Badge variant="outline" className="border-white/20 text-white text-[9px] font-black">
                            CONS: {firstReq.billingConsecutive || '---'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/60 font-medium uppercase">{typedRequests.length} expedientes asociados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Total Facturado</p>
                      <p className="text-xl font-black text-green-400">${totalFactura.toLocaleString()}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow className="bg-slate-50">
                        <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">Valor Aprobado</TableHead>
                        <TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {typedRequests.map((req: ServiceRequest) => (
                          <TableRow key={req.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                            <TableCell><span className="font-bold text-xs uppercase">{req.invoiceServices || req.insuredName}</span></TableCell>
                            <TableCell>{req.purchaseOrder || "—"}</TableCell>
                            <TableCell>{req.accountName || "—"}</TableCell>
                            <TableCell>{req.invoiceDate || req.paidAt || "—"}</TableCell>
                            <TableCell className="text-right font-mono font-black text-slate-800">${(req.approvedAmount ?? req.invoiceAmount ?? 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Link href={`/requests/${req.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"><ChevronRight className="h-4 w-4" /></Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog for Validating Billing and Conciliation */}
      <Dialog open={!!validatingRequest} onOpenChange={(v) => !v && setValidatingRequest(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Facturación Electrónica</DialogTitle>
            <DialogDescription>Asignación de factura para <strong className="text-primary">{validatingRequest?.claimNumber}</strong>.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleValidateBilling} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-dashed">
                <p className="text-[9px] font-black uppercase text-slate-400">Bruto Reportado</p>
                <p className="text-sm font-black text-blue-600">${validatingRequest ? calculateSuggested(validatingRequest).toLocaleString() : 0}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600">Valor Aprobado</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-blue-600" />
                  <Input 
                    name="approvedAmount" 
                    type="number" 
                    defaultValue={validatingRequest?.approvedAmount || (validatingRequest ? calculateSuggested(validatingRequest) : 0)} 
                    className="pl-7 font-black border-blue-200 bg-blue-50/50"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">N° Factura</Label>
                  <Input name="invoiceNumber" placeholder="FE-1025" required className="font-bold uppercase h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Consecutivo RYS</Label>
                  <Input name="billingConsecutive" placeholder="2025-001" required className="font-bold uppercase h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Notas</Label>
                <Textarea name="accountingNotes" placeholder="Notas de conciliación..." className="text-xs" />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setValidatingRequest(null)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 bg-green-600 hover:bg-green-700">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} VALIDAR Y FACTURAR
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
