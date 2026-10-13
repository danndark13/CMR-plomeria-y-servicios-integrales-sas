
"use client"

import { ChangeEvent, useState, useMemo } from "react"
import * as XLSX from "xlsx"
import { useRouter } from "next/navigation"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Plus, 
  Search, 
  Filter, 
  ClipboardList, 
  ChevronRight,
  Loader2,
  Save,
  Building2,
  User,
  MapPin,
  Phone,
  FileText,
  FileSpreadsheet,
  X,
  Download,
  Upload,
  AlertTriangle
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import Link from "next/link"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { collection, doc, addDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { ServiceCategory, ServiceRequest, ServiceStatus, TechnicianIntervention } from "@/lib/types"
import { cn } from "@/lib/utils"

const FINISHED_STATUSES = new Set(["completed", "cancelled"])
const SERVICE_CATEGORIES: ServiceCategory[] = ["Plomería", "Electricidad", "Cerrajería", "Vidriería", "Trabajo en Alturas", "Instalación", "Destaponamiento", "Taponamiento", "Impermeabilización", "Garantía"]
type BulkRequestDraft = {
  claimNumber: string
  accountName: string
  folio: number
  address: string
  city: string
  insuredName: string
  phoneNumber: string
  category: ServiceCategory
  companyId: string
  description: string
  report: string
  technicianId: string
  authorizedByAdvisor: string
}
const normalizeSpreadsheetValue = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
const serviceCategoryDocumentId = (name: string) => {
  const normalized = normalizeSpreadsheetValue(name)
  const slug = normalized.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "servicio"
  const hash = Array.from(normalized).reduce((value, character) => (value * 31 + character.charCodeAt(0)) | 0, 0)
  return `${slug}-${Math.abs(hash).toString(36)}`
}

export default function RequestsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("ALL")
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL")
  const [isCreating, setIsCreating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [bulkRequestsPreview, setBulkRequestsPreview] = useState<BulkRequestDraft[] | null>(null)
  const [bulkRequestsErrors, setBulkRequestsErrors] = useState<string[]>([])
  const [bulkRequestsMessage, setBulkRequestsMessage] = useState("")
  
  // States for dynamic account selection
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [selectedAccountName, setSelectedAccountName] = useState<string>("")
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false)
  
  const { user, isUserLoading } = useUser()
  const db = useFirestore()

  // Fetch current user profile
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  // Fetch real requests from Firestore
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  // Fetch Companies and Accounts
  const companiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "assistance_companies")
  }, [db, user])
  const { data: firestoreCompanies } = useCollection(companiesQuery)

  const serviceCategoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_categories")
  }, [db, user])
  const { data: firestoreServiceCategories, isLoading: isServiceCategoriesLoading } = useCollection(serviceCategoriesQuery)

  const clientAccountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "client_accounts")
  }, [db, user])
  const { data: firestoreAccounts } = useCollection(clientAccountsQuery)

  const isTech = profile?.roleId === 'Técnico'
  const isDev = profile?.roleId === 'Desarrollador'
  const isAdmin = profile?.roleId === 'Administrador' || profile?.roleId === 'Gerente' || isDev
  const canManageStatus = isAdmin || profile?.roleId === 'Servicio al Cliente'

  const allRequests = useMemo(() => {
    const combined = [...(firestoreRequests || [])]
    const seenIds = new Set(combined.map(r => r.id))
    const seenClaims = new Set(combined.map(r => r.claimNumber?.toUpperCase()))
    
    for (const mock of MOCK_REQUESTS) {
      const mockClaim = mock.claimNumber?.toUpperCase()
      if (!seenIds.has(mock.id) && !seenClaims.has(mockClaim)) {
        combined.push(mock)
        seenIds.add(mock.id)
        seenClaims.add(mockClaim)
      }
    }

    if (isTech && profile) {
      return combined.filter(req => 
        req.interventions?.some((i: any) => i.technicianId === profile.username) ||
        req.scheduledVisit?.technicianId === profile.username
      );
    }

    return combined
  }, [firestoreRequests, isTech, profile])

  const filteredRequests = useMemo(() => {
    return allRequests.filter(req => {
      const matchesSearch = (
        (req.claimNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.insuredName || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      const matchesCompany = selectedCompanyFilter === "ALL" || req.companyId === selectedCompanyFilter
      const matchesStatus = selectedStatusFilter === "ALL" || req.status === selectedStatusFilter
      return matchesSearch && matchesCompany && matchesStatus
    }).sort((a, b) => {
      const aFinished = FINISHED_STATUSES.has(a.status)
      const bFinished = FINISHED_STATUSES.has(b.status)
      // Active records first; finished records last
      if (aFinished !== bFinished) return aFinished ? 1 : -1
      // Within the same group: newest first
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [allRequests, searchTerm, selectedCompanyFilter, selectedStatusFilter])

  const allCompanies = useMemo(() => {
    const combined = [...(firestoreCompanies || [])]
    const seenIds = new Set(combined.map(c => c.id))
    MOCK_COMPANIES.forEach(mc => {
      if (!seenIds.has(mc.id)) combined.push(mc)
    })
    return combined
  }, [firestoreCompanies])

  const allServiceCategories = useMemo(() => {
    const categories = [...SERVICE_CATEGORIES]
    ;(firestoreServiceCategories || []).forEach((item: any) => {
      const name = typeof item.name === "string" ? item.name.trim() : ""
      if (name && !categories.some(category => normalizeSpreadsheetValue(category) === normalizeSpreadsheetValue(name))) {
        categories.push(name)
      }
    })
    return categories
  }, [firestoreServiceCategories])

  const downloadRequestsTemplate = () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[
      "expediente", "cuenta", "folio", "direccion", "ciudad", "cliente_usuario", "telefono", "servicio", "asistencia", "que_reportan", "reporte_servicio", "tecnico", "asesor_autoriza"
    ]]), "Expedientes")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Columna", "Instrucciones"],
      ["expediente", "Obligatorio; identificador único del expediente. Si ya existe, se actualizan sus datos."],
      ["cuenta", "Obligatorio; cuenta o plan de la asistencia."],
      ["folio", "Número entero; si está vacío se conserva el existente o se asigna 0 al crear."],
      ["direccion", "Dirección del servicio."],
      ["ciudad", "Ciudad del servicio."],
      ["cliente_usuario", "Nombre del asegurado/usuario."],
      ["telefono", "Número telefónico, opcional."],
      ["servicio", `${allServiceCategories.join(", ")}. Si escribes una categoría nueva, se registrará automáticamente al confirmar la carga.`],
      ["asistencia", `Nombre o ID de la asistencia: ${(allCompanies || []).map(company => company.name).join(", ")}`],
      ["que_reportan", "Descripción inicial del problema; opcional. Si queda vacío en una actualización se conserva la anterior."],
      ["reporte_servicio", "Opcional; texto del ticket/reporte del servicio ya realizado. Si se llena, crea un ticket sin costos ni efecto en nómina."],
      ["tecnico", "Opcional; técnico relacionado con el reporte. Se guarda en el mismo ticket. Puede ser usuario o nombre."],
      ["asesor_autoriza", "Opcional; asesor que autorizó el servicio. Se guarda en el mismo ticket."]
    ]), "Instrucciones")
    XLSX.writeFile(workbook, "Plantilla_carga_masiva_expedientes.xlsx")
  }

  const downloadBulkRequestErrors = () => {
    if (!bulkRequestsErrors.length) return
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Detalle del error de carga masiva"],
      ...bulkRequestsErrors.map(error => [error])
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Errores")
    XLSX.writeFile(workbook, "Errores_carga_masiva_expedientes.xlsx")
  }

  const parseRequestsWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setIsProcessing(true)
    setBulkRequestsErrors([])
    setBulkRequestsPreview(null)
    setBulkRequestsMessage("")
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error("El archivo no contiene hojas.")
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" })
      if (!rows.length) throw new Error("La hoja no contiene filas.")
      const seenClaims = new Set<string>()
      const claimRows = new Map<string, number>()
      const existingByClaim = new Map((firestoreRequests || []).map(request => [
        normalizeSpreadsheetValue(request.claimNumber),
        request
      ]))
      const errors: string[] = []
      const drafts: BulkRequestDraft[] = []
      rows.forEach((row, index) => {
        const values = new Map(Object.entries(row).map(([key, value]) => [normalizeSpreadsheetValue(key).replace(/[^\w]+/g, "_").replace(/^_|_$/g, ""), value]))
        const get = (...keys: string[]) => {
          for (const key of keys) {
            const value = values.get(key)
            if (value !== undefined && String(value).trim()) return String(value).trim()
          }
          return ""
        }
        const claimNumber = get("expediente", "claimnumber", "claim_number", "numero_expediente", "numero_de_expediente", "nro_expediente", "no_expediente", "no_de_expediente", "num_expediente", "id_expediente", "siniestro", "numero_siniestro").toUpperCase()
        if (!claimNumber) {
          errors.push(`Fila ${index + 2} | Expediente: vacío | Columna expediente: falta el número identificador; no se puede identificar el registro.`)
          return
        }
        const normalizedClaim = normalizeSpreadsheetValue(claimNumber)
        if (seenClaims.has(normalizedClaim)) {
          errors.push(`Fila ${index + 2} | Expediente ${claimNumber} | Columna expediente: repetido en el archivo; primera aparición en fila ${claimRows.get(normalizedClaim)}.`)
          return
        }
        seenClaims.add(normalizedClaim)
        claimRows.set(normalizedClaim, index + 2)
        const existing = existingByClaim.get(normalizedClaim)
        const assistanceRaw = get("asistencia", "company", "empresa", "compania", "empresa_asistencia", "compania_asistencia", "aseguradora")
        const assistanceName = normalizeSpreadsheetValue(assistanceRaw)
        const matchedCompanyId = allCompanies.find(company => {
          const names = [normalizeSpreadsheetValue(company.name), normalizeSpreadsheetValue(company.id)]
          return names.some(name => name === assistanceName || (assistanceName.length >= 3 && name.startsWith(assistanceName)) || (name.length >= 3 && assistanceName.startsWith(name)))
        })?.id
        const categoryRaw = get("servicio", "categoria", "category", "tipo_servicio", "categoria_servicio")
        const matchedCategory = allServiceCategories.find(item => normalizeSpreadsheetValue(item) === normalizeSpreadsheetValue(categoryRaw))
        const folioRaw = get("folio", "numero_folio", "no_folio", "no_de_folio")
        const parsedFolio = folioRaw ? Number(folioRaw.replace(/,/g, "")) : undefined
        const validationIssues: string[] = []
        if (assistanceRaw && !matchedCompanyId) validationIssues.push(`asistencia="${assistanceRaw}" no coincide con una asistencia registrada`)
        if (folioRaw && (parsedFolio === undefined || !Number.isInteger(parsedFolio) || parsedFolio < 0)) validationIssues.push(`folio="${folioRaw}" debe ser un número entero mayor o igual a 0`)
        const companyId = matchedCompanyId || (!assistanceRaw ? existing?.companyId : undefined)
        const category = matchedCategory || (categoryRaw ? categoryRaw : existing?.category)
        const folio = parsedFolio !== undefined && Number.isInteger(parsedFolio) && parsedFolio >= 0
          ? parsedFolio
          : existing?.folio ?? 0
        const accountName = get("cuenta", "cuenta_plan", "plan", "account", "accountname", "nombre_cuenta") || existing?.accountName
        const address = get("direccion", "address", "direccion_servicio", "direccion_del_servicio", "ubicacion") || existing?.address
        const city = get("ciudad", "city", "municipio") || existing?.city
        const insuredName = get("cliente_usuario", "cliente_o_usuario", "nombre_cliente_usuario", "asegurado", "cliente", "usuario", "insuredname", "nombre_asegurado", "nombre_usuario", "titular") || existing?.insuredName
        if (!companyId && !assistanceRaw) validationIssues.push(`asistencia: celda vacía${existing ? "" : " (obligatoria para crear expediente)"}`)
        if (!category) validationIssues.push(`servicio: celda vacía${existing ? "" : " (obligatorio para crear expediente)"}`)
        if (!accountName) validationIssues.push(`cuenta: celda vacía${existing ? "" : " (obligatoria para crear expediente)"}`)
        if (!address) validationIssues.push(`direccion: celda vacía${existing ? "" : " (obligatoria para crear expediente)"}`)
        if (!city) validationIssues.push(`ciudad: celda vacía${existing ? "" : " (obligatoria para crear expediente)"}`)
        if (!insuredName) validationIssues.push(`cliente_usuario: celda vacía${existing ? "" : " (obligatoria para crear expediente)"}`)
        if (validationIssues.length) {
          errors.push(`Fila ${index + 2} | Expediente ${claimNumber} | ${Array.from(new Set(validationIssues)).join("; ")}.`)
          return
        }
        drafts.push({
          claimNumber,
          companyId,
          category,
          accountName,
          folio,
          address: address.toUpperCase(),
          city: city.toUpperCase(),
          insuredName: insuredName.toUpperCase(),
          phoneNumber: get("telefono", "celular", "phone", "phonenumber", "telefono_cliente") || existing?.phoneNumber || "",
          description: get("que_reportan", "descripcion", "descripcion_servicio", "description", "motivo", "detalle") || existing?.description || "",
          report: get("reporte_servicio", "reporte", "reporte_tecnico", "informe_servicio", "informe", "ticket_reporte", "observaciones_reporte"),
          technicianId: get("tecnico", "tecnica", "nombre_tecnico", "usuario_tecnico", "tecnico_asignado"),
          authorizedByAdvisor: get("asesor_autoriza", "asesor_que_autoriza", "asesor_autorizador", "asesor", "autorizado_por", "autorizo")
        })
      })
      setBulkRequestsErrors(errors)
      if (!drafts.length) {
        const message = `No hay filas válidas para importar. Corrige los ${errors.length} errores indicados y vuelve a cargar el Excel.`
        setBulkRequestsMessage(message)
        toast({ variant: "destructive", title: "No hay filas importables", description: message })
        return
      }
      if (drafts.length > 450) throw new Error("Carga hasta 450 expedientes por archivo para guardar cada lote de forma segura.")
      setBulkRequestsPreview(drafts)
      const knownCategoryNames = new Set((firestoreServiceCategories || []).map((item: any) => normalizeSpreadsheetValue(item.name)))
      const newCategoryCount = new Set(drafts
        .map(item => item.category.trim())
        .filter(name => !SERVICE_CATEGORIES.some(category => normalizeSpreadsheetValue(category) === normalizeSpreadsheetValue(name)) && !knownCategoryNames.has(normalizeSpreadsheetValue(name)))
        .map(normalizeSpreadsheetValue)).size
      setBulkRequestsMessage(`${drafts.length} filas válidas para revisar antes de importar.${newCategoryCount ? ` Se registrarán ${newCategoryCount} categorías de servicio nuevas.` : ""}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el archivo."
      setBulkRequestsMessage(message)
      toast({ variant: "destructive", title: "Error en la planilla", description: message })
    } finally {
      setIsProcessing(false)
    }
  }

  const importRequests = async () => {
    if (!db || !user || !bulkRequestsPreview?.length || !firestoreRequests) return
    if (isServiceCategoriesLoading || !firestoreServiceCategories) {
      toast({ variant: "destructive", title: "Catálogo de servicios cargando", description: "Espera a que termine de cargar el catálogo y vuelve a confirmar la importación." })
      return
    }
    setIsProcessing(true)
    try {
      const existingByClaim = new Map(firestoreRequests.map(request => [request.claimNumber.toUpperCase().trim(), request]))
      const batch = writeBatch(db)
      const now = new Date().toISOString()
      const existingCategoryNames = new Set(firestoreServiceCategories.map((item: any) => normalizeSpreadsheetValue(item.name)))
      const newCategories = Array.from(new Map(bulkRequestsPreview
        .map(item => item.category.trim())
        .filter(name => !SERVICE_CATEGORIES.some(category => normalizeSpreadsheetValue(category) === normalizeSpreadsheetValue(name)) && !existingCategoryNames.has(normalizeSpreadsheetValue(name)))
        .map(name => [normalizeSpreadsheetValue(name), name])).values())
      if (bulkRequestsPreview.length + newCategories.length > 450) {
        throw new Error(`La carga necesita ${bulkRequestsPreview.length} expedientes y ${newCategories.length} categorías nuevas. El límite seguro es 450 escrituras; divide el archivo en partes más pequeñas.`)
      }
      newCategories.forEach(name => {
        batch.set(doc(db, "service_categories", serviceCategoryDocumentId(name)), {
          name,
          normalizedName: normalizeSpreadsheetValue(name),
          createdAt: now,
          createdBy: user.uid,
        })
      })
      let created = 0
      let updated = 0
      let reportsCreated = 0
      let reportsAlreadyPresent = 0
      bulkRequestsPreview.forEach(item => {
        const existing = existingByClaim.get(item.claimNumber.trim().toUpperCase())
        const metadata = {
          companyId: item.companyId,
          accountName: item.accountName,
          folio: item.folio,
          address: item.address,
          city: item.city,
          insuredName: item.insuredName,
          phoneNumber: item.phoneNumber,
          category: item.category,
          description: item.description,
          updatedAt: now
        }
        if (existing) {
          const existingInterventions = existing.interventions || []
          const matchingBulkTicket = !!item.report.trim() ? existingInterventions.find((intervention: TechnicianIntervention) =>
            intervention.isPayrollExcluded === true &&
            intervention.authorName === "CARGA MASIVA" &&
            (intervention.notes || "").trim() === item.report.trim()
          ) : undefined
          if (matchingBulkTicket) reportsAlreadyPresent++
          const reportIntervention = item.report.trim() && !matchingBulkTicket
            ? {
                id: `bulk-report-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                title: "Reporte de servicio (carga masiva)",
                technicianId: item.technicianId,
                type: "Finalización" as const,
                date: now,
                notes: item.report.trim(),
                reportedValue: 0,
                laborCost: 0,
                usedRotomartillo: false,
                usedGeofono: false,
                usedPlanchaTermofusion: false,
                detailedExpenses: [],
                costLines: [],
                isPayrollExcluded: true,
                authorName: "CARGA MASIVA",
                ...(item.authorizedByAdvisor ? { authorizedByAdvisor: item.authorizedByAdvisor.toUpperCase() } : {}),
              }
            : null
          const interventions = matchingBulkTicket
            ? existingInterventions.map((intervention: TechnicianIntervention) =>
                intervention.id === matchingBulkTicket.id
                  ? {
                      ...intervention,
                      technicianId: item.technicianId || intervention.technicianId || "",
                      ...(item.authorizedByAdvisor ? { authorizedByAdvisor: item.authorizedByAdvisor.toUpperCase() } : {}),
                    }
                  : intervention
              )
            : reportIntervention
              ? [...existingInterventions, reportIntervention]
              : undefined
          batch.update(doc(db, "service_requests", existing.id), {
            ...metadata,
            ...(interventions ? { interventions } : {})
          })
          if (reportIntervention) reportsCreated++
          updated++
        } else {
          const requestRef = doc(collection(db, "service_requests"))
          batch.set(requestRef, {
            ...metadata,
            claimNumber: item.claimNumber,
            description: item.description,
            status: "pending",
            interventions: item.report.trim() ? [{
              id: `bulk-report-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              title: "Reporte de servicio (carga masiva)",
              technicianId: item.technicianId,
              type: "Finalización",
              date: now,
              notes: item.report.trim(),
              reportedValue: 0,
              laborCost: 0,
              usedRotomartillo: false,
              usedGeofono: false,
              usedPlanchaTermofusion: false,
              detailedExpenses: [],
              costLines: [],
              isPayrollExcluded: true,
              authorName: "CARGA MASIVA",
              ...(item.authorizedByAdvisor ? { authorizedByAdvisor: item.authorizedByAdvisor.toUpperCase() } : {}),
            }] : [],
            createdAt: now,
            createdBy: user.uid,
            billingStatus: "pending"
          })
          if (item.report.trim()) reportsCreated++
          created++
        }
      })
      await batch.commit()
      const summary = `${created} expedientes nuevos y ${updated} expedientes existentes actualizados. ${newCategories.length} categorías de servicio nuevas registradas. ${reportsCreated} tickets de reporte creados${reportsAlreadyPresent ? `; ${reportsAlreadyPresent} reportes idénticos ya existían` : ""}. No se agregaron costos ni efectos en nómina. Los demás reportes, intervenciones, estados, facturación y registros de nómina se conservaron.`
      setBulkRequestsMessage(summary)
      setBulkRequestsPreview(null)
      toast({ title: "Carga masiva completada", description: summary })
    } catch (error) {
      console.error("Bulk request import failed:", error)
      toast({ variant: "destructive", title: "No se completó la carga", description: error instanceof Error ? error.message : "Verifica permisos y conexión con Firestore." })
    } finally {
      setIsProcessing(false)
    }
  }

  // Dynamic accounts logic
  const currentCompany = allCompanies.find(c => c.id === selectedCompanyId)
  const availableAccounts = useMemo(() => {
    if (!selectedCompanyId) return []
    const mockAccounts = currentCompany?.accounts || []
    const dbAccounts = (firestoreAccounts || [])
      .filter(acc => acc.assistanceCompanyId === selectedCompanyId)
      .map(acc => acc.name)
    return Array.from(new Set([...mockAccounts, ...dbAccounts])).sort()
  }, [selectedCompanyId, currentCompany, firestoreAccounts])

  const handleUpdateStatus = (requestId: string, newStatus: ServiceStatus) => {
    if (!db) return
    const docRef = doc(db, "service_requests", requestId)
    updateDoc(docRef, { status: newStatus, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Estado Actualizado", description: `Expediente movido a ${newStatus}.` }))
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
          requestResourceData: { status: newStatus },
        })
        errorEmitter.emit("permission-error", permissionError)
      })
  }

  const handleBackfillFolios = async () => {
    if (!db || !firestoreRequests) return
    const missingFolios = firestoreRequests.filter(request => request.folio === undefined || request.folio === null)
    if (!missingFolios.length) {
      toast({ title: "Folios al día", description: "Todos los expedientes existentes ya tienen folio." })
      return
    }

    setIsProcessing(true)
    try {
      for (let index = 0; index < missingFolios.length; index += 450) {
        const batch = writeBatch(db)
        missingFolios.slice(index, index + 450).forEach(request => {
          batch.update(doc(db, "service_requests", request.id), { folio: 0 })
        })
        await batch.commit()
      }
      toast({ title: "Folios completados", description: `Se asignó folio 0 a ${missingFolios.length} expedientes sin folio. No se modificaron otros datos.` })
    } catch (error) {
      console.error("Error asignando folios faltantes:", error)
      toast({ variant: "destructive", title: "No se pudieron completar todos los folios", description: "Los campos de los expedientes no se borraron. Revisa los permisos de Firestore e inténtalo de nuevo." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    
    let finalAccountName = selectedAccountName
    if (isAddingNewAccount) {
      finalAccountName = (formData.get("newAccountName") as string || "").toUpperCase().trim()
      
      if (finalAccountName && selectedCompanyId) {
        const newAccId = Math.random().toString(36).substring(7).toUpperCase()
        const newAccRef = doc(db, "client_accounts", newAccId)
        setDoc(newAccRef, {
          id: newAccId,
          name: finalAccountName,
          assistanceCompanyId: selectedCompanyId,
          createdAt: new Date().toISOString()
        }).catch(err => console.error("Error saving new account:", err))
      }
    }

    const newService = {
      claimNumber: (formData.get("claimNumber") as string).toUpperCase(),
      folio: Math.max(0, Number(formData.get("folio")) || 0),
      category: formData.get("category") as string,
      companyId: selectedCompanyId,
      accountName: finalAccountName,
      insuredName: (formData.get("insuredName") as string).toUpperCase(),
      address: (formData.get("address") as string).toUpperCase(),
      city: (formData.get("city") as string).toUpperCase(),
      phoneNumber: formData.get("phoneNumber") as string,
      description: formData.get("description") as string,
      status: 'pending',
      interventions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.uid,
      billingStatus: 'pending'
    }

    const colRef = collection(db, "service_requests")
    addDoc(colRef, newService)
      .then((docRef) => {
        toast({ title: "Servicio Creado", description: `El expediente ${newService.claimNumber} ha sido registrado.` })
        setIsCreating(false)
        router.push(`/requests/${docRef.id}`)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: colRef.path,
          operation: "create",
          requestResourceData: newService,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  const handleExportExcel = () => {
    const headers = [
      "Expediente", "Fecha", "Asistencia", "Cuenta", "Asegurado", "Dirección", "Ciudad", "Tipo de Servicio", "Estado"
    ]

    const csvRows = filteredRequests.map(req => {
      const companyName = allCompanies.find(c => c.id === req.companyId)?.name || "N/A"

      return [
        req.claimNumber,
        new Date(req.createdAt || "").toLocaleDateString(),
        companyName,
        req.accountName,
        req.insuredName,
        (req.address || "").replace(/,/g, " "),
        (req.city || "").replace(/,/g, " "),
        req.category,
        req.status
      ]
    })

    const csvContent = [
      headers.join(","),
      ...csvRows.map(row => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.body.appendChild(document.createElement("a"))
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `Bitacora_${selectedCompanyFilter === "ALL" ? "Global" : selectedCompanyFilter}_RYS_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    document.body.removeChild(link)

    toast({ title: "Planilla Generada" })
  }

  const canCreate = isAdmin || profile?.roleId === 'Servicio al Cliente'
  const canExport = isAdmin || profile?.roleId === 'Servicio al Cliente' || profile?.roleId === 'Contabilidad'
  const isLoadingTotal = isUserLoading || isRequestsLoading

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Bitácora de Servicios</h1>
          <p className="text-muted-foreground font-medium">
            {profile?.roleId === 'Técnico' ? 'Tus servicios registrados y programados.' : 'Listado de expedientes activos e históricos.'}
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" className="gap-2 font-bold border-green-600 text-green-600 hover:bg-green-50" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar Planilla
            </Button>
          )}
          {canCreate && (
            <Button className="gap-2 shadow-lg h-10 font-bold" onClick={() => setIsCreating(true)}>
              <Plus className="h-5 w-5" /> Crear un nuevo servicio
            </Button>
          )}
          {isAdmin && firestoreRequests?.some(request => request.folio === undefined || request.folio === null) && (
            <Button variant="outline" className="gap-2 h-10 font-bold" onClick={handleBackfillFolios} disabled={isProcessing || isRequestsLoading}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Completar folios existentes
            </Button>
          )}
        </div>
      </div>

      {canCreate && (
        <Card className="border-primary/15 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-primary" /> Carga masiva de expedientes</CardTitle>
            <CardDescription>Las categorías nuevas de servicio se registran automáticamente. En el mismo ticket del reporte puedes indicar técnico y asesor que autorizó (opcional). Los tickets de carga masiva no agregan costos ni afectan nómina.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={downloadRequestsTemplate}><Download className="h-4 w-4" /> Descargar plantilla</Button>
              <Button type="button" variant="outline" className="gap-2" asChild disabled={isProcessing || isRequestsLoading || isServiceCategoriesLoading}>
                <label><FileSpreadsheet className="h-4 w-4" /> Seleccionar Excel<input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={parseRequestsWorkbook} disabled={isProcessing || isRequestsLoading || isServiceCategoriesLoading} /></label>
              </Button>
              {bulkRequestsPreview && <Button type="button" onClick={importRequests} disabled={isProcessing || isRequestsLoading || isServiceCategoriesLoading || !firestoreRequests || !firestoreServiceCategories}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmar carga ({bulkRequestsPreview.length})</Button>}
              {bulkRequestsPreview && <Button type="button" variant="ghost" onClick={() => setBulkRequestsPreview(null)} disabled={isProcessing}>Cancelar</Button>}
            </div>
            {bulkRequestsMessage && <p className="text-sm font-medium text-muted-foreground">{bulkRequestsMessage}</p>}
            {bulkRequestsErrors.length > 0 && (
              <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {bulkRequestsErrors.length} filas omitidas: se indica el número de fila, expediente y columna a corregir.</p>
                  <Button type="button" variant="outline" size="sm" className="bg-white" onClick={downloadBulkRequestErrors}>
                    <Download className="mr-2 h-4 w-4" /> Descargar errores
                  </Button>
                </div>
                <ul className="max-h-64 list-inside list-disc space-y-1 overflow-y-auto">
                  {bulkRequestsErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
                </ul>
              </div>
            )}
            {bulkRequestsPreview && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50"><tr><th className="p-2">Expediente</th><th className="p-2">Acción</th><th className="p-2">Asistencia</th><th className="p-2">Servicio</th><th className="p-2">Cliente/usuario</th><th className="p-2">Dirección</th><th className="p-2">Ticket / reporte</th><th className="p-2">Técnico</th><th className="p-2">Asesor autorizó</th></tr></thead>
                  <tbody>{bulkRequestsPreview.slice(0, 20).map((draft, index) => {
                    const found = firestoreRequests?.some(request => request.claimNumber.trim().toUpperCase() === draft.claimNumber)
                    return <tr key={`${draft.claimNumber}-${index}`} className="border-t"><td className="p-2 font-bold">{draft.claimNumber}</td><td className="p-2">{found ? "Actualizar datos" : "Crear expediente"}</td><td className="p-2">{allCompanies.find(company => company.id === draft.companyId)?.name || draft.companyId}</td><td className="p-2">{draft.category}</td><td className="p-2">{draft.insuredName}</td><td className="p-2">{draft.address}, {draft.city}</td><td className="max-w-xs p-2">{draft.report ? `${draft.report.slice(0, 100)}${draft.report.length > 100 ? "..." : ""}` : "Sin reporte"}</td><td className="p-2">{draft.technicianId || "—"}</td><td className="p-2">{draft.authorizedByAdvisor || "—"}</td></tr>
                  })}</tbody>
                </table>
                {bulkRequestsPreview.length > 20 && <p className="p-2 text-xs text-muted-foreground">Mostrando las primeras 20 de {bulkRequestsPreview.length} filas.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader className="p-4 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Expediente, Cliente..." 
                className="pl-10 h-10 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {!isTech && (
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <span className="text-[10px] font-black uppercase text-muted-foreground shrink-0"><Filter className="h-3 w-3 inline mr-1" /> Empresa:</span>
                <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
                  <SelectTrigger className="h-10 w-full lg:w-[220px] font-bold uppercase text-[11px] border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">TODAS LAS EMPRESAS</SelectItem>
                    {allCompanies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-[10px] font-black uppercase text-muted-foreground shrink-0">Estado:</span>
                <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                  <SelectTrigger className="h-10 w-full lg:w-[180px] font-bold uppercase text-[11px] border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">TODOS LOS ESTADOS</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="assigned">Programado</SelectItem>
                    <SelectItem value="in_progress">En Proceso</SelectItem>
                    <SelectItem value="completed">Finalizado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="warranty">Garantía</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Expediente / Categoría</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Cliente / Cuenta</TableHead>
                {!isTech && <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Estado Operativo / Facturación</TableHead>}
                {isTech && <TableHead className="font-black uppercase text-[10px] tracking-widest">Ubicación</TableHead>}
                <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTotal ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                    <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronizando bitácora...</p>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No se encontraron servicios con los filtros aplicados.</TableCell>
                </TableRow>
              ) : filteredRequests.map((req) => {
                return (
                  <TableRow 
                    key={req.id} 
                    className="hover:bg-primary/5 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/requests/${req.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-black text-primary text-sm">{req.claimNumber}</span>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{req.category} · Folio {req.folio ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm truncate max-w-[200px] uppercase">{req.insuredName}</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">{req.accountName}</span>
                      </div>
                    </TableCell>
                    {!isTech && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {canManageStatus ? (
                          <div className="flex flex-col items-center gap-1">
                            <Select defaultValue={req.status} onValueChange={(v) => handleUpdateStatus(req.id, v as ServiceStatus)}>
                              <SelectTrigger className="h-8 w-[140px] text-[10px] font-black uppercase border-primary/20 mx-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendiente</SelectItem>
                                <SelectItem value="assigned">Programado</SelectItem>
                                <SelectItem value="in_progress">En Proceso</SelectItem>
                                <SelectItem value="completed">Finalizado</SelectItem>
                                <SelectItem value="cancelled">Cancelado</SelectItem>
                                <SelectItem value="warranty">Garantía</SelectItem>
                              </SelectContent>
                            </Select>
                            {(req.billingStatus === "validated" || req.billingStatus === "paid") && (
                              <Badge className="bg-green-600 text-[9px] font-black">VALIDADO</Badge>
                            )}
                          </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                              <StatusBadge status={req.status} />
                              {(req.billingStatus === "validated" || req.billingStatus === "paid") && (
                                <Badge className="bg-green-600 text-[9px] font-black">VALIDADO</Badge>
                              )}
                            </div>
                          )}
                      </TableCell>
                    )}
                    {isTech && (
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{req.address} • {req.city}</span>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1 font-bold text-xs border-primary/20 text-primary hover:bg-primary/5">
                          Ver Detalle <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreating} onOpenChange={(open) => {
        setIsCreating(open)
        if (!open) {
          setSelectedCompanyId("")
          setSelectedAccountName("")
          setIsAddingNewAccount(false)
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Apertura de Expediente</DialogTitle>
            <DialogDescription>Seleccione la asistencia y la cuenta cliente de forma dinámica.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateService} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">N° de Expediente / Claim</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="claimNumber" placeholder="EJ: EXP-123456" required className="pl-10 font-mono font-bold uppercase h-12" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Folio</Label>
                <Input name="folio" type="number" min="0" step="1" defaultValue="0" className="h-12 font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Categoría de Servicio</Label>
                <Select name="category" required>
                  <SelectTrigger className="font-bold h-12">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Plomería">Plomería</SelectItem>
                    <SelectItem value="Electricidad">Electricidad</SelectItem>
                    <SelectItem value="Cerrajería">Cerrajería</SelectItem>
                    <SelectItem value="Vidriería">Vidriería</SelectItem>
                    <SelectItem value="Trabajo en Alturas">Trabajo en Alturas</SelectItem>
                    <SelectItem value="Instalación">Instalación</SelectItem>
                    <SelectItem value="Destaponamiento">Destaponamiento</SelectItem>
                    <SelectItem value="Taponamiento">Taponamiento</SelectItem>
                    <SelectItem value="Impermeabilización">Impermeabilización</SelectItem>
                    <SelectItem value="Garantía">Garantía</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Empresa de Asistencia</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => {
                  setSelectedCompanyId(v)
                  setSelectedAccountName("")
                  setIsAddingNewAccount(false)
                }} required>
                  <SelectTrigger className="font-bold h-12">
                    <SelectValue placeholder="Seleccionar aliado" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Cuenta Cliente</Label>
                <Select 
                  value={isAddingNewAccount ? "NEW" : selectedAccountName} 
                  onValueChange={(v) => {
                    if (v === "NEW") {
                      setIsAddingNewAccount(true)
                      setSelectedAccountName("")
                    } else {
                      setIsAddingNewAccount(false)
                      setSelectedAccountName(v)
                    }
                  }} 
                  disabled={!selectedCompanyId}
                  required={!isAddingNewAccount}
                >
                  <SelectTrigger className="font-bold h-12">
                    <SelectValue placeholder={selectedCompanyId ? "Seleccionar cuenta" : "Primero elija asistencia"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map(acc => (
                      <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                    ))}
                    <SelectItem value="NEW" className="font-bold text-primary italic">+ OTRA (Agregar nueva...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isAddingNewAccount && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Nombre de la Nueva Cuenta</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input 
                    name="newAccountName" 
                    placeholder="Escriba el nombre de la cuenta..." 
                    required 
                    className="pl-10 font-black uppercase h-12 border-primary"
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed space-y-4">
               <p className="text-[11px] font-black uppercase text-primary tracking-widest border-b pb-2">Datos del Cliente Final</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="insuredName" placeholder="Juan Perez" required className="pl-10 font-bold uppercase h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="phoneNumber" placeholder="310 000 0000" required className="pl-10 font-bold h-10" />
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Dirección de Visita</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="address" placeholder="Calle 1 #2-3" required className="pl-10 font-medium h-10 uppercase" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Ciudad</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="city" placeholder="Ej. Bogota" required className="pl-10 font-bold uppercase h-10" />
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción de la Solicitud</Label>
              <Textarea name="description" placeholder="Describa el problema reportado..." className="min-h-[80px]" required />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)} disabled={isProcessing} className="font-bold h-12 px-8">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 px-10">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} CREAR SERVICIO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
