
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Wallet, 
  ChevronRight,
  ArrowLeft,
  HandCoins,
  History,
  Loader2,
  CheckCircle2,
  Calculator,
  Save,
  DollarSign,
  AlertCircle,
  FileText,
  Hammer,
  ArrowRight,
  Info,
  Car,
  Trash2,
  FileSpreadsheet,
  Download,
  FileDown,
  MessageSquare
} from "lucide-react"
import { MOCK_TECHNICIANS } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, writeBatch, deleteDoc, query, orderBy, updateDoc, setDoc, runTransaction, where, limit, startAfter, getDocs, onSnapshot, QueryDocumentSnapshot, DocumentData } from "firebase/firestore"
import { TechnicianIntervention, ServiceRequest, PayrollRecord, Advance, TechnicianPayrollSettings, Expense, PayrollDeductionTicket } from "@/lib/types"
import { cn } from "@/lib/utils"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

const normalizePayrollCity = (city?: string) =>
  city?.trim().replace(/\s+/g, " ").toUpperCase() || ""

export default function PayrollHubPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [cityFilter, setCityFilter] = useState("")
  const [citySearchInput, setCitySearchInput] = useState("")
  const cityQueryValues = useMemo(() => {
    if (!cityFilter) return []
    const city = cityFilter.trim().replace(/\s+/g, " ")
    const lowercaseCity = city.toLocaleLowerCase("es-CO")
    const titleCaseCity = lowercaseCity.replace(/(^|\s)\p{L}/gu, letter => letter.toLocaleUpperCase("es-CO"))
    return Array.from(new Set([city, lowercaseCity, titleCaseCity]))
  }, [cityFilter])
  const [visibleCityServiceCount, setVisibleCityServiceCount] = useState(50)
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null)
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null)
  const [officeHours, setOfficeHours] = useState("")
  const [officeHourlyRate, setOfficeHourlyRate] = useState("")
  const [officeAmountToPay, setOfficeAmountToPay] = useState("")
  const [officeTicketAmounts, setOfficeTicketAmounts] = useState<Record<string, string>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([])
  const [firstHistoryPage, setFirstHistoryPage] = useState<PayrollRecord[] | null>(null)
  const [olderHistory, setOlderHistory] = useState<PayrollRecord[]>([])
  const [historyCursor, setHistoryCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const historyPageIds = useRef("")
  
  const [adjustmentAmount, setAdjustmentAmount] = useState(0)
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [payrollNotes, setPayrollNotes] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Transferencia")
  const [paymentReference, setPaymentReference] = useState("")
  const [excludedInterventionIds, setExcludedInterventionIds] = useState<string[]>([])
  const [excludedAdvanceIds, setExcludedAdvanceIds] = useState<string[]>([])
  const [excludedDeductionTicketIds, setExcludedDeductionTicketIds] = useState<string[]>([])
  const [deductionTicketAmounts, setDeductionTicketAmounts] = useState<Record<string, number>>({})
  const [servicePercentage, setServicePercentage] = useState(50)
  const [visitPercentage, setVisitPercentage] = useState(50)
  const [manualPayrollAmounts, setManualPayrollAmounts] = useState<Record<string, number>>({})
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [selectedUnassignedRequest, setSelectedUnassignedRequest] = useState<ServiceRequest | null>(null)
  const [paidRequestTicket, setPaidRequestTicket] = useState({
    technicianId: "",
    subservice: "",
    report: "",
    invoiceAmount: "",
    materialsAmount: "0",
    deductionsAmount: "0",
    deductionsDescription: ""
  })

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, "user_profiles", user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)
  const isDev = profile?.roleId === 'Desarrollador'

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user || cityQueryValues.length === 0) return null
    return query(collection(db, "service_requests"), where("city", "in", cityQueryValues))
  }, [db, user, cityQueryValues])
  const { data: requestsForCity, isLoading: isRequestsLoading } = useCollection(requestsQuery)
  const allRequests = cityFilter ? requestsForCity : null

  const payrollQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "payroll_history"), orderBy("date", "desc"), limit(50))
  }, [db, user])
  useEffect(() => {
    if (!payrollQuery) {
      setFirstHistoryPage(null)
      setOlderHistory([])
      setHistoryCursor(null)
      setHasMoreHistory(false)
      setIsHistoryLoading(false)
      historyPageIds.current = ""
      return
    }
    setIsHistoryLoading(true)
    const unsubscribe = onSnapshot(
      payrollQuery,
      snapshot => {
        const pageIds = JSON.stringify(snapshot.docs.map(payrollDoc => payrollDoc.id))
        if (historyPageIds.current && historyPageIds.current !== pageIds) {
          setOlderHistory([])
          setSelectedHistoryItems([])
        }
        historyPageIds.current = pageIds
        setFirstHistoryPage(snapshot.docs.map(payrollDoc => ({ ...payrollDoc.data(), id: payrollDoc.id } as PayrollRecord)))
        setHistoryCursor(snapshot.docs.at(-1) || null)
        setHasMoreHistory(snapshot.docs.length === 50)
        setIsHistoryLoading(false)
      },
      error => {
        console.error("Loading payroll history failed:", error)
        setIsHistoryLoading(false)
        toast({ variant: "destructive", title: "No se pudo cargar el historial", description: error.message })
      }
    )
    return unsubscribe
  }, [payrollQuery])

  const payrollHistory = useMemo(() => {
    const records = new Map<string, PayrollRecord>()
    for (const record of [...(firstHistoryPage || []), ...olderHistory]) records.set(record.id, record)
    return Array.from(records.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [firstHistoryPage, olderHistory])

  const loadMoreHistory = async () => {
    if (!db || !historyCursor || isLoadingMoreHistory) return
    setIsLoadingMoreHistory(true)
    const currentPageIds = historyPageIds.current
    try {
      const snapshot = await getDocs(query(
        collection(db, "payroll_history"),
        orderBy("date", "desc"),
        startAfter(historyCursor),
        limit(50)
      ))
      if (historyPageIds.current !== currentPageIds) return
      const page = snapshot.docs.map(payrollDoc => ({ ...payrollDoc.data(), id: payrollDoc.id } as PayrollRecord))
      setOlderHistory(current => [...current, ...page])
      setHistoryCursor(snapshot.docs.at(-1) || historyCursor)
      setHasMoreHistory(snapshot.docs.length === 50)
    } catch (error) {
      console.error("Loading older payroll history failed:", error)
      toast({
        variant: "destructive",
        title: "No se pudo cargar más historial",
        description: error instanceof Error ? error.message : "Verifica la conexión con Firestore."
      })
    } finally {
      setIsLoadingMoreHistory(false)
    }
  }

  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: allUsers } = useCollection(usersQuery)
  const officePayrollQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "payroll_history"), where("employeeType", "==", "office"))
  }, [db, user])
  const { data: officePayrollHistory } = useCollection<PayrollRecord>(officePayrollQuery)
  const payrollSettingsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "technician_payroll_settings")
  }, [db, user])
  const { data: payrollSettings } = useCollection<TechnicianPayrollSettings>(payrollSettingsQuery)
  const deductionTicketsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "payroll_deduction_tickets")
  }, [db, user])
  const { data: deductionTickets } = useCollection<PayrollDeductionTicket>(deductionTicketsQuery)

  const technicianAliases = useMemo(() => {
    const aliases = new Map<string, string>()
    const addAlias = (alias: string | undefined, id: string) => {
      if (alias?.trim()) aliases.set(alias.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase(), id)
    }
    ;(allUsers || []).filter(userProfile => userProfile.roleId === "Técnico").forEach(userProfile => {
      const id = (userProfile.username || userProfile.id).toUpperCase().trim()
      addAlias(userProfile.username, id)
      addAlias(userProfile.id, id)
      addAlias(`${userProfile.firstName} ${userProfile.lastName || ""}`, id)
    })
    MOCK_TECHNICIANS.forEach(technician => {
      addAlias(technician.id, technician.id.toUpperCase().trim())
      addAlias(technician.name, technician.id.toUpperCase().trim())
    })
    return aliases
  }, [allUsers])

  const canonicalTechnicianId = useCallback((value?: string) => {
    if (!value?.trim()) return ""
    const normalized = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase()
    return technicianAliases.get(normalized) || normalized
  }, [technicianAliases])

  const allTechnicians = useMemo(() => {
    const uniqueMap = new Map()
    if (allUsers) {
      allUsers.filter(u => u.roleId === 'Técnico').forEach(u => {
        const uname = (u.username || u.id).toUpperCase().trim()
        if (!uniqueMap.has(uname)) {
          const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.displayName || u.name || u.username
          uniqueMap.set(uname, { id: uname, name: name || `TÉCNICO SIN PERFIL · ${uname.slice(-6)}`, specialties: ['Técnico'] })
        }
      })
    }
    MOCK_TECHNICIANS.forEach(mt => {
      const uname = mt.id.toUpperCase().trim()
      if (!uniqueMap.has(uname)) {
        uniqueMap.set(uname, mt)
      }
    })
    ;(allRequests || []).forEach((request: ServiceRequest) => {
      [...(request.interventions || []).map(intervention => intervention.technicianId), ...(request.advances || []).map(advance => advance.technicianId)]
        .filter((technicianId): technicianId is string => !!technicianId?.trim())
        .forEach(technicianId => {
          const id = canonicalTechnicianId(technicianId)
          if (!uniqueMap.has(id)) uniqueMap.set(id, { id, name: `TÉCNICO SIN PERFIL · ${id.slice(-6)}`, specialties: ["Técnico"] })
        })
    })
    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allUsers, allRequests, canonicalTechnicianId])

  const selectedTech = allTechnicians.find(t => t.id === selectedTechId)
  const officeStaff = (allUsers || [])
    .filter(person => person.roleId !== "Técnico" && person.isActive !== false)
    .map(person => ({
      id: person.id,
      name: `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.username || person.id,
      role: person.roleId || "Personal de oficina"
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectedOfficeStaff = officeStaff.find(person => person.id === selectedOfficeId)
  const getPayrollPersonName = (id: string) =>
    allTechnicians.find(person => canonicalTechnicianId(person.id) === canonicalTechnicianId(id))?.name ||
    officeStaff.find(person => person.id === id)?.name ||
    (() => {
      const normalizedId = canonicalTechnicianId(id)
      const person = (allUsers || []).find(userProfile =>
        userProfile.id === id || canonicalTechnicianId(userProfile.username) === normalizedId
      )
      return person
        ? `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.displayName || person.name || person.username
        : null
    })() ||
    (id ? `TÉCNICO SIN PERFIL · ${id.slice(-6)}` : "PERSONAL SIN NOMBRE")
  const officeOpenTickets = (deductionTickets || []).filter(ticket =>
    ticket.personType === "office" && ticket.personId === selectedOfficeId && ticket.remainingAmount > 0
  )
  const officeGross = (Number(officeHours) || 0) * (Number(officeHourlyRate) || 0)
  const officeAppliedTickets = officeOpenTickets.reduce<Array<{ ticket: PayrollDeductionTicket; amount: number }>>((items, ticket) => {
    const remainingGross = Math.max(0, officeGross - items.reduce((sum, item) => sum + item.amount, 0))
    const selectedAmount = officeTicketAmounts[ticket.id]
    const amount = Math.min(
      ticket.remainingAmount,
      Math.max(0, selectedAmount === undefined ? remainingGross : Number(selectedAmount) || 0)
    )
    items.push({ ticket, amount })
    return items
  }, [])
  const officeTotalDeductions = officeAppliedTickets.reduce((sum, item) => sum + item.amount, 0)
  const officeCurrentBalance = Math.max(0, officeGross - officeTotalDeductions)
  const previousOfficeBalance = (officePayrollHistory || [])
    .filter(record => record.technicianId === selectedOfficeId)
    .reduce((sum, record) => sum + Math.max(0, record.pendingPaymentAmount || 0), 0)
  const officeTotalDue = officeCurrentBalance + previousOfficeBalance
  const canPayIntervention = useCallback((request: ServiceRequest, intervention: TechnicianIntervention) =>
    request.billingStatus === "validated" || request.billingStatus === "paid" || request.status === "completed" || intervention.isReadyForPayroll === true,
  [])

  const pendingByTechnician = useMemo(() => {
    type PendingItems = {
      interventions: Array<{ intervention: TechnicianIntervention; request: ServiceRequest }>
      advances: Array<{ advance: Advance; request: ServiceRequest }>
      tickets: PayrollDeductionTicket[]
    }
    const byTechnician = new Map<string, PendingItems>()
    const getItems = (technicianId: string) => {
      let items = byTechnician.get(technicianId)
      if (!items) {
        items = { interventions: [], advances: [], tickets: [] }
        byTechnician.set(technicianId, items)
      }
      return items
    }

    for (const request of allRequests || []) {
      if (cityFilter && normalizePayrollCity(request.city) !== cityFilter) continue
      for (const intervention of request.interventions || []) {
        const technicianId = canonicalTechnicianId(intervention.technicianId)
        if (!technicianId || intervention.isPayrollExcluded || intervention.payrollStatus === "processed") continue
        getItems(technicianId).interventions.push({ intervention, request })
      }
      for (const advance of request.advances || []) {
        const technicianId = canonicalTechnicianId(advance.technicianId)
        if (!technicianId || advance.isPaidInPayroll) continue
        getItems(technicianId).advances.push({ advance, request })
      }
    }

    for (const ticket of deductionTickets || []) {
      const technicianId = canonicalTechnicianId(ticket.personId)
      if (!cityFilter && ticket.personType === "technician" && technicianId && ticket.remainingAmount > 0) {
        getItems(technicianId).tickets.push(ticket)
      }
    }
    return byTechnician
  }, [allRequests, deductionTickets, canonicalTechnicianId, cityFilter])

  const visibleTechnicians = useMemo(
    () => allTechnicians.filter(technician => {
      const pending = pendingByTechnician.get(technician.id)
      return !!pending && (
        pending.interventions.length > 0 ||
        pending.advances.length > 0 ||
        (!cityFilter && pending.tickets.length > 0)
      )
    }),
    [allTechnicians, pendingByTechnician, cityFilter]
  )

  const cityServiceRows = useMemo(() => {
    if (!cityFilter) return []
    const rows: Array<{ request: ServiceRequest; intervention: TechnicianIntervention | null; technicianId: string }> = []
    for (const request of allRequests || []) {
      if (normalizePayrollCity(request.city) !== cityFilter) continue
      const interventions = request.interventions || []
      if (interventions.length === 0) {
        rows.push({ request, intervention: null, technicianId: "" })
        continue
      }
      for (const intervention of interventions) {
        rows.push({ request, intervention, technicianId: intervention.technicianId?.trim() || "" })
      }
    }
    return rows
  }, [allRequests, cityFilter])

  const paidRequestsWithoutTechnician = useMemo(
    () => (allRequests || []).filter(request =>
      (request.billingStatus === "validated" || request.billingStatus === "paid") &&
      !(request.interventions || []).some((intervention: TechnicianIntervention) =>
        intervention.technicianId?.trim() && !intervention.isPayrollExcluded
      )
    ),
    [allRequests]
  )

  useEffect(() => {
    if (!selectedTechId) return
    const settings = payrollSettings?.find(item => item.technicianId === selectedTechId)
    setServicePercentage(settings?.servicePercentage ?? 50)
    setVisitPercentage(settings?.visitPercentage ?? 50)
    setManualPayrollAmounts({})
    setExcludedDeductionTicketIds([])
    setDeductionTicketAmounts({})
  }, [selectedTechId, payrollSettings])

  const handleSavePayrollSettings = async () => {
    if (!db || !selectedTechId) return
    if (!Number.isFinite(servicePercentage) || !Number.isFinite(visitPercentage) || servicePercentage < 0 || servicePercentage > 100 || visitPercentage < 0 || visitPercentage > 100) {
      toast({ variant: "destructive", title: "Porcentajes inválidos", description: "Los porcentajes deben estar entre 0 y 100." })
      return
    }
    setIsSavingSettings(true)
    try {
      await setDoc(doc(db, "technician_payroll_settings", selectedTechId), {
        technicianId: selectedTechId,
        servicePercentage,
        visitPercentage,
        updatedAt: new Date().toISOString()
      })
      toast({ title: "Porcentajes guardados", description: "Se aplicarán a las próximas liquidaciones de este técnico." })
    } catch {
      toast({ variant: "destructive", title: "No se pudieron guardar los porcentajes" })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const pendingInterventions = useMemo(() => {
    return (allRequests || []).flatMap((req: ServiceRequest) => 
      (req.interventions || [])
        .filter((i: any) => {
          if (i.isPayrollExcluded) return false
          const isCorrectTech = canonicalTechnicianId(i.technicianId) === selectedTechId
          const notProcessed = i.payrollStatus !== 'processed'
          const matchesCity = !cityFilter || normalizePayrollCity(req.city) === cityFilter
          return isCorrectTech && notProcessed && matchesCity
        })
        .map((i: any) => ({ ...i, request: req }))
    )
  }, [allRequests, selectedTechId, canonicalTechnicianId, canPayIntervention, cityFilter])

  const interventionsToApprove = useMemo(() => {
    return (allRequests || []).flatMap((req: ServiceRequest) => 
      (req.interventions || [])
        .filter((i: any) => {
          if (i.isPayrollExcluded) return false
          const notProcessed = i.payrollStatus !== 'processed'
          const notApproved = !i.isReadyForPayroll
          const notValidated = req.billingStatus !== 'validated' && req.status !== 'completed'
          const matchesCity = !cityFilter || normalizePayrollCity(req.city) === cityFilter
          return notProcessed && notApproved && notValidated && matchesCity
        })
        .map((i: any) => ({ ...i, request: req }))
    )
  }, [allRequests, cityFilter])

  const pendingAdvances = useMemo(() => {
    return (allRequests || []).flatMap((req: ServiceRequest) => 
      (req.advances || [])
        .filter((a: any) =>
          canonicalTechnicianId(a.technicianId) === selectedTechId &&
          !a.isPaidInPayroll &&
          (!cityFilter || normalizePayrollCity(req.city) === cityFilter)
        )
        .map((a: any) => ({ ...a, request: req }))
    )
  }, [allRequests, selectedTechId, canonicalTechnicianId, cityFilter])

  const selectedInterventions = useMemo(
    () => pendingInterventions.filter(item => canPayIntervention(item.request, item) && !excludedInterventionIds.includes(item.id)),
    [pendingInterventions, excludedInterventionIds, canPayIntervention]
  )
  const selectedAdvances = useMemo(
    () => pendingAdvances.filter(item => !excludedAdvanceIds.includes(item.id)),
    [pendingAdvances, excludedAdvanceIds]
  )
  const pendingTechnicianTickets = (deductionTickets || []).filter(ticket =>
    ticket.personType === "technician" && canonicalTechnicianId(ticket.personId) === selectedTechId && ticket.remainingAmount > 0
  )
  const selectedTechnicianTickets = pendingTechnicianTickets.filter(ticket => !excludedDeductionTicketIds.includes(ticket.id))

  const getPayrollAmount = (intervention: TechnicianIntervention) => {
    const manualAmount = manualPayrollAmounts[intervention.id]
    if (manualAmount !== undefined) return manualAmount
    const materialExpenses = (intervention.detailedExpenses || [])
      .filter(expense => !expense.isUnused)
      .reduce((sum, expense) => sum + (expense.amount || 0), 0)
    const rentals = (intervention.usedRotomartillo ? 80000 : 0)
      + (intervention.usedGeofono ? 120000 : 0)
      + (intervention.usedPlanchaTermofusion ? 70000 : 0)
    const valueAfterCosts = Math.max(0, (intervention.reportedValue || 0) - materialExpenses - rentals - (intervention.payrollDeductionAmount || 0))
    const percentage = intervention.isSimpleVisit ? visitPercentage : servicePercentage
    return valueAfterCosts * percentage / 100
  }

  const technicianAmountBeforeTickets =
    selectedInterventions.reduce((sum, item) => sum + getPayrollAmount(item), 0) -
    selectedAdvances.reduce((sum, item) => sum + (item.amount || 0), 0) +
    adjustmentAmount
  const appliedTechnicianTickets = selectedTechnicianTickets.reduce<Array<{ ticket: PayrollDeductionTicket; amount: number }>>((items, ticket) => {
    const remainingPay = Math.max(0, technicianAmountBeforeTickets - items.reduce((sum, item) => sum + item.amount, 0))
    const amount = Math.min(
      ticket.remainingAmount,
      Math.max(0, deductionTicketAmounts[ticket.id] ?? remainingPay)
    )
    items.push({ ticket, amount })
    return items
  }, [])
  const totalTechnicianTicketDeductions = appliedTechnicianTickets.reduce((sum, item) => sum + item.amount, 0)

  const totals = useMemo(() => {
    let totalGross = 0
    let totalExpenses = 0
    let totalRentals = 0
    let totalFee = 0
    let accumulatedToSplit = 0
    let totalPreSplitDeductions = 0
    const totalSimpleVisitBonus = 0

    selectedInterventions.forEach((i: any) => {
      const gross = i.reportedValue || 0
      const materialExpenses = (i.detailedExpenses || []).filter((e: any) => !e.isUnused).reduce((s: number, e: any) => s + (e.amount || 0), 0)
      
      let rentals = 0
      if (i.usedRotomartillo) rentals += 80000
      if (i.usedGeofono) rentals += 120000
      if (i.usedPlanchaTermofusion) rentals += 70000
      totalGross += gross
      totalExpenses += materialExpenses
      totalRentals += rentals
      totalPreSplitDeductions += i.payrollDeductionAmount || 0

      accumulatedToSplit += getPayrollAmount(i)
    })

    const totalAdvances = selectedAdvances.reduce((s, a) => s + (a.amount || 0), 0) + totalTechnicianTicketDeductions
    const technicianBase = accumulatedToSplit
    const netPaid = technicianBase - totalAdvances + adjustmentAmount

    return { totalGross, totalExpenses, totalRentals, totalFee, totalPreSplitDeductions, accumulatedToSplit, totalAdvances, technicianBase, netPaid, totalSimpleVisitBonus }
  }, [selectedInterventions, selectedAdvances, adjustmentAmount, manualPayrollAmounts, servicePercentage, visitPercentage, totalTechnicianTicketDeductions])

  const createValidatedRequestTicket = async () => {
    if (!db || !selectedUnassignedRequest) return
    const technician = allTechnicians.find(item => item.id === paidRequestTicket.technicianId)
    const invoiceAmount = Number(paidRequestTicket.invoiceAmount)
    const materialsAmount = Number(paidRequestTicket.materialsAmount)
    const deductionsAmount = Number(paidRequestTicket.deductionsAmount)
    const remainingToSplit = invoiceAmount - materialsAmount - deductionsAmount
    if (!technician || !paidRequestTicket.subservice.trim() || !paidRequestTicket.report.trim() ||
      !Number.isFinite(invoiceAmount) || invoiceAmount <= 0 ||
      !Number.isFinite(materialsAmount) || materialsAmount < 0 ||
      !Number.isFinite(deductionsAmount) || deductionsAmount < 0 ||
      remainingToSplit < 0 ||
      (deductionsAmount > 0 && !paidRequestTicket.deductionsDescription.trim())) {
      toast({
        variant: "destructive",
        title: "Revisa los datos del ticket",
        description: "Asigna un técnico, completa subservicio y reporte, ingresa valores válidos y describe cualquier descuento o adelanto."
      })
      return
    }

    const now = new Date().toISOString()
    const intervention: TechnicianIntervention = {
      id: crypto.randomUUID(),
      title: paidRequestTicket.subservice.trim(),
      technicianId: technician.id,
      type: "Finalización",
      visitType: "Intervención",
      subservice: paidRequestTicket.subservice.trim(),
      date: now,
      notes: paidRequestTicket.report.trim(),
      reportedValue: invoiceAmount,
      laborCost: invoiceAmount,
      usedRotomartillo: false,
      usedGeofono: false,
      usedPlanchaTermofusion: false,
      detailedExpenses: materialsAmount > 0 ? [{
        id: crypto.randomUUID(),
        amount: materialsAmount,
        description: "Materiales descontados antes de repartir",
        category: "material",
        isUnused: false
      }] : [],
      payrollDeductionAmount: deductionsAmount,
      ...(deductionsAmount > 0 ? { payrollDeductionDescription: paidRequestTicket.deductionsDescription.trim() } : {}),
      isReadyForPayroll: true,
      payrollStatus: "pending"
    }
    const request = selectedUnassignedRequest
    const statusHistory = request.status === "completed"
      ? request.statusHistory || []
      : [...(request.statusHistory || []), { status: "completed" as const, date: now }]

    setIsProcessing(true)
    try {
      await updateDoc(doc(db, "service_requests", request.id), {
        interventions: [...(request.interventions || []), intervention],
        invoiceAmount,
        serviceSubservice: intervention.subservice,
        status: "completed",
        statusHistory,
        updatedAt: now
      })
      toast({
        title: "Ticket enviado a nómina",
        description: `${request.claimNumber}: $${remainingToSplit.toLocaleString("es-CO")} quedan para repartir; el técnico ${technician.name} ya tiene el servicio pendiente de liquidación.`
      })
      setSelectedUnassignedRequest(null)
      setPaidRequestTicket({
        technicianId: "",
        subservice: "",
        report: "",
        invoiceAmount: "",
        materialsAmount: "0",
        deductionsAmount: "0",
        deductionsDescription: ""
      })
    } catch (error) {
      console.error("Creating payroll ticket for validated request failed:", error)
      toast({
        variant: "destructive",
        title: "No se pudo crear el ticket",
        description: error instanceof Error ? error.message : "Verifica los permisos y la conexión con Firestore."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const generatePayrollPDF = (records: PayrollRecord[]) => {
    const doc = new jsPDF()
    
    records.forEach((record, index) => {
      if (index > 0) doc.addPage()
      
      const techName = getPayrollPersonName(record.technicianId)
      const dateStr = new Date(record.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

      // HEADER
      doc.setFontSize(18)
      doc.setTextColor(31, 91, 204)
      doc.text("PLOMERÍA Y SERVICIOS RYS SAS", 105, 20, { align: 'center' })
      
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Nit: 901.601.017 | Comprobante de Nómina ${record.employeeType === "office" ? "Oficina" : "Técnico"}`, 105, 26, { align: 'center' })
      
      doc.setDrawColor(200)
      doc.line(20, 32, 190, 32)

      // INFO SECTION
      doc.setFontSize(11)
      doc.setTextColor(0)
      doc.setFont("helvetica", "bold")
      doc.text(record.employeeType === "office" ? "PERSONAL:" : "TÉCNICO:", 20, 45)
      doc.setFont("helvetica", "normal")
      doc.text(techName.toUpperCase(), 50, 45)

      doc.setFont("helvetica", "bold")
      doc.text("FECHA:", 20, 52)
      doc.setFont("helvetica", "normal")
      doc.text(dateStr, 50, 52)

      doc.setFont("helvetica", "bold")
      doc.text("REF LIQ:", 20, 59)
      doc.setFont("helvetica", "normal")
      doc.text(record.id, 50, 59)
      doc.setFont("helvetica", "bold")
      doc.text("MÉTODO:", 20, 66)
      doc.setFont("helvetica", "normal")
      doc.text(record.paymentMethod || "No registrado", 50, 66)
      if (record.paymentReference) {
        doc.setFont("helvetica", "bold")
        doc.text("COMPROBANTE:", 100, 66)
        doc.setFont("helvetica", "normal")
        doc.text(record.paymentReference.slice(0, 30), 127, 66)
      }

      // ITEMS TABLE
      const relatedRequests = (allRequests || []).filter((request: ServiceRequest) =>
        request.interventions?.some((intervention: TechnicianIntervention) => intervention.payrollId === record.id)
      )
      const tableRows = record.employeeType === "office"
        ? [[`${record.hoursWorked || 0} horas`, "NÓMINA DE OFICINA", `Valor hora: $${(record.hourlyRate || 0).toLocaleString("es-CO")}`, `$${(record.grossSalary || record.totalGross).toLocaleString("es-CO")}`]]
        : record.processedItems?.length
        ? record.processedItems.map(item => [
            item.claimNumber,
            item.service,
            item.preSplitDeductionAmount
              ? `${item.subservice}\nDescuento antes de repartir: $${item.preSplitDeductionAmount.toLocaleString("es-CO")}${item.preSplitDeductionDescription ? ` · ${item.preSplitDeductionDescription}` : ""}`
              : item.subservice,
            `$${item.technicianAmount.toLocaleString("es-CO")}`
          ])
        : relatedRequests.flatMap(request => request.interventions
            .filter((intervention: TechnicianIntervention) => intervention.payrollId === record.id)
            .map((intervention: TechnicianIntervention) => {
              const materials = (intervention.detailedExpenses || []).filter((expense: Expense) => !expense.isUnused).reduce((sum: number, expense: Expense) => sum + (expense.amount || 0), 0)
              const rentals = (intervention.usedRotomartillo ? 80000 : 0) + (intervention.usedGeofono ? 120000 : 0) + (intervention.usedPlanchaTermofusion ? 70000 : 0)
              const oldSubtotal = intervention.reportedValue - materials - rentals
              const oldFee = oldSubtotal > 0 ? oldSubtotal * 0.1 : 0
              const oldNet = intervention.isSimpleVisit
                ? (20000 / 2) + ((Math.max(0, intervention.reportedValue - 20000 - materials - rentals) - oldFee) / 2)
                : (oldSubtotal - oldFee) / 2
              return [
                request.claimNumber,
                request.category,
                intervention.subservice || request.serviceSubservice || intervention.type,
                `$${oldNet.toLocaleString("es-CO")}`
              ]
            }))

      autoTable(doc, {
        startY: 74,
        head: [['EXPEDIENTE', 'SERVICIO', 'SUBSERVICIO', 'TOTAL']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 91, 204], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' }
        }
      })

      let currentY = (doc as any).lastAutoTable.finalY + 10

      const deductions = record.deductions || (allRequests || []).flatMap((request: ServiceRequest) =>
        (request.advances || [])
          .filter(advance => advance.payrollId === record.id || record.processedAdvanceIds.includes(advance.id))
          .map(advance => ({ date: advance.date, claimNumber: request.claimNumber, description: advance.reason, amount: advance.amount }))
      )
      if (deductions.length) {
        autoTable(doc, {
          startY: currentY,
          head: [["FECHA", "EXPEDIENTE RELACIONADO", "DESCRIPCIÓN", "TOTAL"]],
          body: deductions.map(item => [
            item.date ? new Date(item.date).toLocaleDateString("es-CO") : "—",
            item.claimNumber || "N/A",
            item.description,
            `-$${item.amount.toLocaleString("es-CO")}`
          ]),
          theme: "striped",
          headStyles: { fillColor: [31, 91, 204], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: { 3: { halign: "right", textColor: [180, 40, 40] } },
          didDrawPage: () => undefined
        })
        currentY = (doc as any).lastAutoTable.finalY + 8
      }

      // NOTES SECTION
      if (record.notes) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("NOVEDADES / NOTAS:", 20, currentY)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        const splitNotes = doc.splitTextToSize(record.notes, 170)
        doc.text(splitNotes, 20, currentY + 6)
        currentY += (splitNotes.length * 5) + 15
      }

      // FINALS SECTION
      doc.setDrawColor(230)
      doc.setFillColor(245, 245, 245)
      doc.rect(120, currentY, 70, 40, 'F')

      doc.setFontSize(10)
      doc.setTextColor(80)
      const serviceSubtotal = record.serviceSubtotal ?? record.netPaid + record.totalAdvances - (record.adjustmentAmount || 0)
      const deductionsTotal = deductions.reduce((sum, item) => sum + item.amount, 0) || record.totalAdvances
      doc.text("SUBTOTAL:", 125, currentY + 9)
      doc.text(`$${serviceSubtotal.toLocaleString("es-CO")}`, 185, currentY + 9, { align: 'right' })

      doc.text("DESCUENTOS / ADELANTOS:", 125, currentY + 17)
      doc.text(`-$${deductionsTotal.toLocaleString("es-CO")}`, 185, currentY + 17, { align: 'right' })

      if (record.adjustmentAmount !== 0) {
        doc.text("AJUSTES / BONOS:", 125, currentY + 25)
        doc.text(`${record.adjustmentAmount > 0 ? '+' : '-'}$${Math.abs(record.adjustmentAmount).toLocaleString("es-CO")}`, 185, currentY + 25, { align: 'right' })
      }

      doc.setFontSize(12)
      doc.setTextColor(31, 91, 204)
      doc.setFont("helvetica", "bold")
      doc.text("GRAN TOTAL:", 125, currentY + 35)
      doc.text(`$${record.netPaid.toLocaleString("es-CO")}`, 185, currentY + 35, { align: 'right' })

      // FOOTER
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.setFont("helvetica", "italic")
      doc.text("Nota: Materiales, alquileres y descuentos pre-reparto se restan antes de aplicar el porcentaje del técnico.", 20, 280)
      if (record.totalPreSplitDeductions) {
        doc.text(`Descuentos antes de repartir: $${record.totalPreSplitDeductions.toLocaleString("es-CO")}`, 20, 275)
      }
      doc.text("Este documento es un soporte interno de liquidación corporativa.", 20, 285)
    })

    doc.save(`Nomina_RYS_${new Date().toISOString().split('T')[0]}.pdf`)
    toast({ title: "PDF Generado" })
  }

  const generateCollectionAccountPDF = (record: PayrollRecord) => {
    const pdf = new jsPDF()
    const technicianName = getPayrollPersonName(record.technicianId)
    const serviceSubtotal = record.serviceSubtotal ?? record.netPaid + record.totalAdvances - (record.adjustmentAmount || 0)
    const deductions = record.deductions || []

    pdf.setFontSize(17)
    pdf.setTextColor(31, 91, 204)
    pdf.text("CUENTA DE COBRO", 105, 20, { align: "center" })
    pdf.setFontSize(10)
    pdf.setTextColor(80)
    pdf.text("PLOMERÍA Y SERVICIOS RYS SAS · NIT 901.601.017", 105, 28, { align: "center" })
    pdf.text(`Proveedor: ${technicianName}`, 20, 42)
    pdf.text(`Fecha: ${new Date(record.date).toLocaleDateString("es-CO")}`, 20, 50)
    pdf.text(`Liquidación: ${record.id}`, 20, 58)

    pdf.setFillColor(235, 242, 255)
    pdf.roundedRect(20, 66, 170, 30, 3, 3, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text("VALOR DEL SOPORTE CONTABLE (SUBTOTAL DE SERVICIOS)", 26, 77)
    pdf.setFontSize(19)
    pdf.setTextColor(31, 91, 204)
    pdf.text(`$${serviceSubtotal.toLocaleString("es-CO")}`, 26, 89)

    autoTable(pdf, {
      startY: 105,
      head: [["RESUMEN", "VALOR"]],
      body: [
        ["Subtotal de servicios (valor de la cuenta de cobro)", `$${serviceSubtotal.toLocaleString("es-CO")}`],
        ["Adelantos / descuentos aplicados", `-$${record.totalAdvances.toLocaleString("es-CO")}`],
        ["Valor pendiente de pago", `$${record.netPaid.toLocaleString("es-CO")}`]
      ],
      theme: "grid",
      headStyles: { fillColor: [31, 91, 204], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } }
    })

    const tableEnd = (pdf as any).lastAutoTable.finalY + 8
    if (deductions.length) {
      autoTable(pdf, {
        startY: tableEnd,
        head: [["FECHA", "EXPEDIENTE RELACIONADO", "DESCRIPCIÓN", "TOTAL"]],
        body: deductions.map(item => [
          item.date ? new Date(item.date).toLocaleDateString("es-CO") : "—",
          item.claimNumber || "N/A",
          item.description,
          `-$${item.amount.toLocaleString("es-CO")}`
        ]),
        theme: "striped",
        headStyles: { fillColor: [31, 91, 204], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 3 }
      })
    }

    let y = deductions.length ? (pdf as any).lastAutoTable.finalY + 10 : tableEnd
    if (y > 208) {
      pdf.addPage()
      y = 22
    }
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(40)
    pdf.text("DECLARACIÓN DEL PROVEEDOR (marcar una opción)", 20, y)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    const questions = [
      "¿Es responsable del IVA?   [   ] Sí   [   ] No",
      "¿Ha contratado dos o más trabajadores por más de 90 días?   [   ] Sí   [   ] No",
      "¿Está obligado a declarar renta?   [   ] Sí   [   ] No"
    ]
    questions.forEach((question, index) => pdf.text(question, 20, y + 9 + index * 8))
    pdf.setFontSize(8)
    pdf.setTextColor(120)
    pdf.text("El proveedor debe marcar las respuestas. El subtotal de servicios es el valor de la cuenta de cobro; los adelantos reducen el saldo pendiente, no el soporte contable.", 20, y + 39, { maxWidth: 170 })
    pdf.line(20, 270, 85, 270)
    pdf.line(120, 270, 190, 270)
    pdf.text("Firma proveedor", 20, 276)
    pdf.text("Firma autorizada", 120, 276)
    pdf.save(`Cuenta_cobro_${record.technicianId}_${record.id}.pdf`)
    toast({ title: "Cuenta de cobro generada" })
  }

  const exportCityServicesExcel = () => {
    if (!cityFilter || !cityServiceRows.length) return

    const rows = cityServiceRows.map(({ request, intervention }) => {
      const technicianId = intervention?.technicianId?.trim() || ""
      const availability = !intervention
        ? "Sin servicio reportado"
        : intervention.isPayrollExcluded
          ? "Solo referencia · no pagable"
          : intervention.payrollStatus === "processed"
            ? "Ya liquidado"
            : canPayIntervention(request, intervention)
              ? "Listo para liquidar"
              : "Requiere autorización o cierre"

      return {
        Expediente: request.claimNumber,
        "Técnico indicado": technicianId ? getPayrollPersonName(technicianId) : "Sin técnico en el reporte",
        "Servicio / reporte": intervention?.title || intervention?.subservice || request.serviceSubservice || request.category,
        "Descripción del servicio": intervention?.notes || request.description || "Sin descripción",
        "Estado expediente": `${request.status} · ${request.billingStatus}`,
        "Valor reportado": intervention?.reportedValue || 0,
        Disponibilidad: availability,
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 30 },
      { wch: 32 },
      { wch: 60 },
      { wch: 28 },
      { wch: 20 },
      { wch: 36 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Servicios por ciudad")
    const cityFileName = cityFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/gi, "_")
    XLSX.writeFile(workbook, `Servicios_${cityFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast({ title: "Excel descargado", description: `Se exportaron ${rows.length} registros de ${cityFilter}.` })
  }

  const exportPayrollCSV = () => {
    if (!selectedInterventions.length && !selectedAdvances.length) return

    const rows: string[][] = [
      ["Tipo", "Expediente", "Detalle", "Valor reportado", "Materiales", "Descuentos antes de repartir", "Base para repartir", "Alquileres", "Neto técnico"]
    ]

    selectedInterventions.forEach((item: any) => {
      const materials = (item.detailedExpenses || [])
        .filter((expense: any) => !expense.isUnused)
        .reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0)
      const rentals = (item.usedRotomartillo ? 80000 : 0)
        + (item.usedGeofono ? 120000 : 0)
        + (item.usedPlanchaTermofusion ? 70000 : 0)

      rows.push([
        item.request.category,
        item.request.claimNumber,
        item.subservice || item.request.serviceSubservice || item.type,
        String(item.reportedValue || 0),
        String(materials),
        String(item.payrollDeductionAmount || 0),
        String(Math.max(0, (item.reportedValue || 0) - materials - rentals - (item.payrollDeductionAmount || 0))),
        String(rentals),
        String(getPayrollAmount(item))
      ])
    })

    selectedAdvances.forEach((advance: any) => {
      rows.push(["Anticipo", advance.request.claimNumber, advance.reason, "0", "0", "0", "0", "0", String(-advance.amount)])
    })

    rows.push(["", "", "Ajuste", "", "", "", "", "", String(adjustmentAmount)])
    rows.push(["", "", "Neto estimado", "", "", "", "", "", String(totals.netPaid)])

    const csv = "\uFEFF" + rows
      .map(row => row.map((value, index) => {
        const safeValue = index < 3 && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
        return `"${safeValue.replaceAll('"', '""')}"`
      }).join(","))
      .join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `nomina_${selectedTechId}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleGeneratePayroll = async () => {
    const ticketDeductions = appliedTechnicianTickets.filter(item => item.amount > 0)
    if (!db || !selectedTechId || (selectedInterventions.length === 0 && selectedAdvances.length === 0 && ticketDeductions.length === 0)) return
    if (ticketDeductions.reduce((sum, item) => sum + item.amount, 0) > Math.max(0, technicianAmountBeforeTickets)) {
      toast({ variant: "destructive", title: "El descuento supera el valor liquidable", description: "Reduce el valor aplicado del ticket o aumenta los servicios incluidos." })
      return
    }
    
    setIsProcessing(true)
    const payrollId = `LIQ-${crypto.randomUUID().toUpperCase()}`
    
    const payrollRecord: PayrollRecord = {
      id: payrollId,
      technicianId: selectedTechId,
      employeeType: "technician",
      date: new Date().toISOString(),
      totalGross: totals.totalGross,
      feeAmount: totals.totalFee,
      totalRentals: totals.totalRentals,
      totalExpenses: totals.totalExpenses,
      totalAdvances: totals.totalAdvances,
      totalPreSplitDeductions: totals.totalPreSplitDeductions,
      amountToSplit: totals.accumulatedToSplit,
      netPaid: totals.netPaid,
      serviceSubtotal: totals.technicianBase,
      adjustmentAmount,
      adjustmentReason,
      notes: payrollNotes,
      paymentMethod,
      paymentReference: paymentReference.trim(),
      itemsCount: selectedInterventions.length,
      processedInterventionIds: selectedInterventions.map(i => i.id),
      processedAdvanceIds: selectedAdvances.map(a => a.id),
      deductionTicketIds: ticketDeductions.map(item => item.ticket.id),
      servicePercentage,
      visitPercentage,
      processedItems: selectedInterventions.map(item => ({
        interventionId: item.id,
        claimNumber: item.request.claimNumber,
        service: item.request.category,
        subservice: item.subservice || item.request.serviceSubservice || item.type,
        visitType: item.visitType,
        grossValue: item.reportedValue || 0,
        technicianAmount: getPayrollAmount(item),
        materialsAmount: (item.detailedExpenses || []).filter((expense: Expense) => !expense.isUnused).reduce((sum: number, expense: Expense) => sum + (expense.amount || 0), 0),
        preSplitDeductionAmount: item.payrollDeductionAmount || 0,
        ...(item.payrollDeductionDescription ? { preSplitDeductionDescription: item.payrollDeductionDescription } : {}),
        splitBase: Math.max(
          0,
          (item.reportedValue || 0) -
            (item.detailedExpenses || []).filter((expense: Expense) => !expense.isUnused).reduce((sum: number, expense: Expense) => sum + (expense.amount || 0), 0) -
            (item.usedRotomartillo ? 80000 : 0) -
            (item.usedGeofono ? 120000 : 0) -
            (item.usedPlanchaTermofusion ? 70000 : 0) -
            (item.payrollDeductionAmount || 0)
        )
      })),
      deductions: [
        ...selectedAdvances.map(advance => ({
        advanceId: advance.id,
        date: advance.date,
        claimNumber: advance.request.claimNumber,
        description: advance.reason,
        amount: advance.amount || 0
        })),
        ...ticketDeductions.map(({ ticket, amount }) => ({
          advanceId: ticket.id,
          date: ticket.date,
          claimNumber: "TICKET",
          description: ticket.description,
          amount
        }))
      ]
    }
    
    try {
      const selectedInterventionsByRequest = new Map<string, Set<string>>()
      selectedInterventions.forEach(item => {
        const ids = selectedInterventionsByRequest.get(item.request.id) || new Set<string>()
        ids.add(item.id)
        selectedInterventionsByRequest.set(item.request.id, ids)
      })
      const selectedAdvancesByRequest = new Map<string, Set<string>>()
      selectedAdvances.forEach(item => {
        const ids = selectedAdvancesByRequest.get(item.request.id) || new Set<string>()
        ids.add(item.id)
        selectedAdvancesByRequest.set(item.request.id, ids)
      })
      const requestIds = new Set([...selectedInterventionsByRequest.keys(), ...selectedAdvancesByRequest.keys()])
      const requestRefs = Array.from(requestIds, id => doc(db, "service_requests", id))
      const ticketRefs = ticketDeductions.map(({ ticket }) => doc(db, "payroll_deduction_tickets", ticket.id))
      const payrollRef = doc(db, "payroll_history", payrollId)

      await runTransaction(db, async transaction => {
        const [requestSnapshots, ticketSnapshots, existingPayroll] = await Promise.all([
          Promise.all(requestRefs.map(ref => transaction.get(ref))),
          Promise.all(ticketRefs.map(ref => transaction.get(ref))),
          transaction.get(payrollRef)
        ])
        if (existingPayroll.exists()) throw new Error("Se detectó una referencia de nómina repetida. Intenta guardar de nuevo.")

        const requests = new Map<string, ServiceRequest>()
        requestSnapshots.forEach(snapshot => {
          if (!snapshot.exists()) throw new Error("Un expediente seleccionado ya no existe. Actualiza la pantalla antes de liquidar.")
          requests.set(snapshot.id, { ...snapshot.data(), id: snapshot.id } as ServiceRequest)
        })
        for (const item of selectedInterventions) {
          const current = (requests.get(item.request.id)?.interventions || []).find(intervention => intervention.id === item.id)
          const payrollInputs = (intervention: TechnicianIntervention) => JSON.stringify([
            intervention.reportedValue || 0,
            (intervention.detailedExpenses || [])
              .map(expense => [expense.id, expense.amount || 0, expense.isUnused === true])
              .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
            intervention.usedRotomartillo === true,
            intervention.usedGeofono === true,
            intervention.usedPlanchaTermofusion === true,
            intervention.payrollDeductionAmount || 0
          ])
          if (!current || current.payrollStatus === "processed" || current.isPayrollExcluded ||
            canonicalTechnicianId(current.technicianId) !== selectedTechId || !canPayIntervention(requests.get(item.request.id)!, current)) {
            throw new Error("Uno de los servicios seleccionados ya fue liquidado o dejó de estar disponible. Actualiza la pantalla; no se creó otro pago.")
          }
          if (payrollInputs(current) !== payrollInputs(item)) {
            throw new Error("Los valores de un servicio cambiaron durante la liquidación. Actualiza la pantalla y revisa el cálculo.")
          }
        }
        for (const item of selectedAdvances) {
          const current = (requests.get(item.request.id)?.advances || []).find(advance => advance.id === item.id)
          if (!current || current.isPaidInPayroll || canonicalTechnicianId(current.technicianId) !== selectedTechId ||
            current.amount !== item.amount) {
            throw new Error("Uno de los adelantos seleccionados ya fue aplicado o cambió. Actualiza la pantalla; no se creó otro pago.")
          }
        }
        ticketDeductions.forEach(({ ticket, amount }, index) => {
          const snapshot = ticketSnapshots[index]
          const current = snapshot.exists() ? snapshot.data() as PayrollDeductionTicket : null
          if (!current || current.personType !== "technician" ||
            canonicalTechnicianId(current.personId) !== selectedTechId || current.remainingAmount < amount) {
            throw new Error("El saldo de un descuento cambió y ya no alcanza para este cálculo. Actualiza la pantalla y revisa la nómina.")
          }
        })

        transaction.set(payrollRef, payrollRecord)
        requests.forEach((request, requestId) => {
          const interventionIds = selectedInterventionsByRequest.get(requestId) || new Set<string>()
          const advanceIds = selectedAdvancesByRequest.get(requestId) || new Set<string>()
          transaction.update(doc(db, "service_requests", requestId), {
            interventions: (request.interventions || []).map(intervention =>
              interventionIds.has(intervention.id)
                ? { ...intervention, payrollStatus: "processed", payrollId, isReadyForPayroll: false }
                : intervention
            ),
            advances: (request.advances || []).map(advance =>
              advanceIds.has(advance.id) ? { ...advance, isPaidInPayroll: true, payrollId } : advance
            ),
            updatedAt: new Date().toISOString()
          })
        })
        ticketDeductions.forEach(({ ticket, amount }, index) => {
          const current = ticketSnapshots[index].data() as PayrollDeductionTicket
          transaction.update(ticketRefs[index], {
            remainingAmount: current.remainingAmount - amount,
            updatedAt: new Date().toISOString(),
            lastPayrollId: payrollId
          })
        })
      })
      toast({ title: "Nómina Liquidada" })
      setAdjustmentAmount(0); setAdjustmentReason(""); setPayrollNotes(""); setPaymentMethod("Transferencia"); setPaymentReference(""); setExcludedInterventionIds([]); setExcludedAdvanceIds([]); setExcludedDeductionTicketIds([]); setDeductionTicketAmounts({}); setManualPayrollAmounts({}); setSelectedTechId(null)
    } catch (error) {
      console.error("Saving technician payroll failed:", error)
      toast({
        variant: "destructive",
        title: "No se pudo guardar la nómina",
        description: error instanceof Error ? error.message : "Verifica permisos y conexión con Firestore."
      })
    } finally {
      setIsProcessing(false)
    }

  }

  const handleApproveIntervention = async (reqId: string, interventionId: string) => {
    if (!db) return
    setIsProcessing(true)
    try {
      const req = (allRequests || []).find(r => r.id === reqId)
      if (!req) return
      
      const updatedInterventions = req.interventions.map((i: any) => {
        if (i.id === interventionId) return { ...i, isReadyForPayroll: true }
        return i
      })
      
      await updateDoc(doc(db, "service_requests", reqId), { 
        interventions: updatedInterventions, 
        updatedAt: new Date().toISOString() 
      })
      
      toast({ title: "Servicio Aprobado", description: "El servicio ya puede ser liquidado en nómina." })
    } catch (error) {
      toast({ variant: "destructive", title: "Error al aprobar" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeletePayroll = async (record: PayrollRecord) => {
    if (!db || !isDev) return
    if (record.carriedToPayrollId) {
      toast({ variant: "destructive", title: "No se puede eliminar", description: "Este saldo ya fue trasladado a otra nómina. Elimina primero la nómina más reciente." })
      return
    }
    setIsProcessing(true)
    
    try {
      const batch = writeBatch(db)
      const requestsToUpdate = (allRequests || []).filter((req: ServiceRequest) => 
        req.interventions?.some((i: any) => i.payrollId === record.id) ||
        req.advances?.some((a: any) => a.payrollId === record.id)
      )

      requestsToUpdate.forEach((req: ServiceRequest) => {
        const updatedInterventions = req.interventions.map((i: any) => {
          if (i.payrollId === record.id) {
            return { ...i, payrollStatus: 'pending' as const, payrollId: undefined }
          }
          return i
        })
        const updatedAdvances = (req.advances || []).map((a: any) => {
          if (a.payrollId === record.id) {
            return { ...a, isPaidInPayroll: false, payrollId: undefined }
          }
          return a
        })
        batch.update(doc(db, "service_requests", req.id), { interventions: updatedInterventions, advances: updatedAdvances })
      })

      for (const deduction of record.deductions || []) {
        const ticket = (deductionTickets || []).find(item => item.id === deduction.advanceId)
        if (ticket) {
          batch.update(doc(db, "payroll_deduction_tickets", ticket.id), {
            remainingAmount: ticket.remainingAmount + deduction.amount,
            updatedAt: new Date().toISOString(),
            lastPayrollId: null
          })
        }
      }
      for (const carried of record.carriedPayments || []) {
        batch.update(doc(db, "payroll_history", carried.payrollId), {
          pendingPaymentAmount: carried.amount,
          carriedToPayrollId: null,
          updatedAt: new Date().toISOString()
        })
      }

      batch.delete(doc(db, "payroll_history", record.id))
      await batch.commit()
      const carriedRecords = new Map((record.carriedPayments || []).map(item => [item.payrollId, item.amount]))
      const restoreCarriedPayment = (item: PayrollRecord) => {
        const amount = carriedRecords.get(item.id)
        return amount === undefined ? item : { ...item, pendingPaymentAmount: amount, carriedToPayrollId: undefined }
      }
      setFirstHistoryPage(current => current?.filter(item => item.id !== record.id).map(restoreCarriedPayment) || current)
      setOlderHistory(current => current.filter(item => item.id !== record.id).map(restoreCarriedPayment))
      toast({ title: "Registro Eliminado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTogglePaid = async (record: PayrollRecord) => {
    if (!db) return
    const nowPaid = !record.isPaid
    const paidAt = nowPaid ? new Date().toISOString() : null
    const pendingPaymentAmount = record.employeeType === "office"
      ? nowPaid
        ? 0
        : record.pendingPaymentAmount || Math.max(0, (record.grossSalary || record.totalGross) - record.totalAdvances + (record.adjustmentAmount || 0)) + (record.carriedPayments || []).reduce((sum, item) => sum + item.amount, 0)
      : undefined
    try {
      const { updateDoc } = await import("firebase/firestore")
      await updateDoc(doc(db, "payroll_history", record.id), {
        isPaid: nowPaid,
        paidAt,
        ...(pendingPaymentAmount !== undefined ? { pendingPaymentAmount } : {})
      })
      const updateRecord = (item: PayrollRecord) => item.id === record.id
        ? { ...item, isPaid: nowPaid, paidAt: paidAt || undefined, ...(pendingPaymentAmount !== undefined ? { pendingPaymentAmount } : {}) }
        : item
      setFirstHistoryPage(current => current?.map(updateRecord) || current)
      setOlderHistory(current => current.map(updateRecord))
      toast({ title: nowPaid ? "Nómina marcada como PAGADA ✅" : "Nómina marcada como PENDIENTE" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar estado" })
    }
  }
  const handleGenerateOfficePayroll = async () => {
    if (!db || !selectedOfficeStaff) return
    const hours = Number(officeHours)
    const hourlyRate = Number(officeHourlyRate)
    const paidToday = officeAmountToPay === "" ? officeTotalDue : Number(officeAmountToPay)
    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(hourlyRate) || hourlyRate <= 0 || !Number.isFinite(officeGross) ||
      !Number.isFinite(paidToday) || paidToday < 0 || paidToday > officeTotalDue ||
      officeAppliedTickets.some(item => item.amount < 0 || item.amount > item.ticket.remainingAmount) ||
      officeTotalDeductions > officeGross) {
      toast({
        variant: "destructive",
        title: "Revisa los datos de nómina",
        description: "Ingresa horas y valor por hora válidos, no descuentes más que el salario y limita el pago al saldo disponible."
      })
      return
    }

    setIsProcessing(true)
    const batch = writeBatch(db)
    const now = new Date().toISOString()
    const payrollId = `NOM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const pendingPayment = officeTotalDue - paidToday
    const previousPendingRecords = (officePayrollHistory || []).filter(record =>
      record.technicianId === selectedOfficeStaff.id && (record.pendingPaymentAmount || 0) > 0
    )
    const ticketDeductions = officeAppliedTickets.filter(item => item.amount > 0)
    const payrollRecord: PayrollRecord = {
      id: payrollId,
      technicianId: selectedOfficeStaff.id,
      employeeType: "office",
      date: now,
      totalGross: officeGross,
      feeAmount: 0,
      totalRentals: 0,
      totalExpenses: 0,
      totalAdvances: officeTotalDeductions,
      amountToSplit: officeCurrentBalance,
      netPaid: paidToday,
      pendingPaymentAmount: pendingPayment,
      outstandingDeductionBalance: officeOpenTickets.reduce((sum, ticket) =>
        sum + ticket.remainingAmount - (officeAppliedTickets.find(item => item.ticket.id === ticket.id)?.amount || 0), 0
      ),
      adjustmentAmount: 0,
      notes: `Horas: ${hours} · Valor por hora: $${hourlyRate.toLocaleString("es-CO")}`,
      paymentMethod,
      paymentReference: paymentReference.trim(),
      itemsCount: 1,
      processedInterventionIds: [],
      processedAdvanceIds: [],
      deductionTicketIds: ticketDeductions.map(item => item.ticket.id),
      deductions: ticketDeductions.map(({ ticket, amount }) => ({
        advanceId: ticket.id,
        date: ticket.date,
        claimNumber: "TICKET",
        description: ticket.description,
        amount
      })),
      carriedPayments: previousPendingRecords
        .map(record => ({ payrollId: record.id, amount: record.pendingPaymentAmount || 0 }))
        .filter(item => item.amount > 0),
      isPaid: pendingPayment === 0,
      ...(pendingPayment === 0 ? { paidAt: now } : {}),
      hoursWorked: hours,
      hourlyRate,
      grossSalary: officeGross
    }
    batch.set(doc(db, "payroll_history", payrollId), payrollRecord)
    ticketDeductions.forEach(({ ticket, amount: applied }) => {
      batch.update(doc(db, "payroll_deduction_tickets", ticket.id), {
        remainingAmount: ticket.remainingAmount - applied,
        updatedAt: now,
        lastPayrollId: payrollId
      })
    })
    previousPendingRecords.forEach(record => {
      batch.update(doc(db, "payroll_history", record.id), {
        pendingPaymentAmount: 0,
        carriedToPayrollId: payrollId,
        updatedAt: now
      })
    })
    try {
      await batch.commit()
      toast({
        title: "Nómina de oficina liquidada",
        description: pendingPayment > 0
          ? `Pago registrado: $${paidToday.toLocaleString("es-CO")}. Saldo de nómina pendiente: $${pendingPayment.toLocaleString("es-CO")}.`
          : `${selectedOfficeStaff.name}: $${paidToday.toLocaleString("es-CO")}.`
      })
      setSelectedOfficeId(null)
      setOfficeHours("")
      setOfficeHourlyRate("")
      setOfficeAmountToPay("")
      setOfficeTicketAmounts({})
      setPaymentReference("")
    } catch (error) {
      console.error("Saving office payroll failed:", error)
      toast({ variant: "destructive", title: "No se pudo guardar la nómina", description: error instanceof Error ? error.message : "Verifica los permisos y la conexión con Firestore." })
    } finally {
      setIsProcessing(false)
    }
  }

  if (selectedOfficeId) {
    const amountToPay = officeAmountToPay === "" ? officeTotalDue : Number(officeAmountToPay)
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-20">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedOfficeId(null)} className="border-primary text-primary"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">{selectedOfficeStaff?.name || "Personal de oficina"}</h1>
            <p className="text-sm text-muted-foreground">Nómina por horas · {selectedOfficeStaff?.role}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="office-hours">Horas trabajadas</Label><Input id="office-hours" type="number" min="0.01" step="0.25" value={officeHours} onChange={event => setOfficeHours(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="office-hourly-rate">Valor por hora</Label><Input id="office-hourly-rate" type="number" min="1" step="100" value={officeHourlyRate} onChange={event => setOfficeHourlyRate(event.target.value)} /></div>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Salario bruto</p><p className="text-xl font-bold">${officeGross.toLocaleString("es-CO")}</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Descuentos y adelantos</CardTitle><CardDescription>Puedes aplicar el descuento completo o solo una parte; el saldo restante seguirá pendiente para otra nómina.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {officeOpenTickets.length === 0 && <p className="text-sm text-muted-foreground">No tiene tickets pendientes.</p>}
            {officeOpenTickets.map(ticket => (
              <div key={ticket.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_180px] md:items-center">
                <div><p className="font-semibold">{ticket.description}</p><p className="text-xs text-muted-foreground">{new Date(ticket.date).toLocaleDateString("es-CO")} · Saldo pendiente: ${ticket.remainingAmount.toLocaleString("es-CO")}</p></div>
                <div className="space-y-1"><Label htmlFor={`office-ticket-${ticket.id}`}>Descontar ahora</Label><Input id={`office-ticket-${ticket.id}`} type="number" min="0" max={ticket.remainingAmount} value={officeTicketAmounts[ticket.id] ?? String(officeAppliedTickets.find(item => item.ticket.id === ticket.id)?.amount || 0)} onChange={event => setOfficeTicketAmounts(current => ({ ...current, [ticket.id]: event.target.value }))} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary">
          <CardHeader><CardTitle>Resumen y pago</CardTitle><CardDescription>Los descuentos no aplicados y cualquier saldo de nómina no pagado se trasladan como pendientes.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Salario de este periodo: <strong>${officeGross.toLocaleString("es-CO")}</strong></p>
              <p>Descuentos aplicados: <strong className="text-destructive">-${officeTotalDeductions.toLocaleString("es-CO")}</strong></p>
              <p>Saldo de nóminas anteriores: <strong>${previousOfficeBalance.toLocaleString("es-CO")}</strong></p>
              <p>Saldo disponible para pagar: <strong>${officeTotalDue.toLocaleString("es-CO")}</strong></p>
              <p>Descuento que queda pendiente: <strong>${officeAppliedTickets.reduce((sum, item) => sum + item.ticket.remainingAmount - item.amount, 0).toLocaleString("es-CO")}</strong></p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="office-amount-to-pay">Cuánto se pagará hoy</Label><Input id="office-amount-to-pay" type="number" min="0" max={officeTotalDue} value={officeAmountToPay === "" ? officeTotalDue : officeAmountToPay} onChange={event => setOfficeAmountToPay(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="office-payment-reference">Referencia de pago</Label><Input id="office-payment-reference" value={paymentReference} onChange={event => setPaymentReference(event.target.value)} placeholder="Número o comprobante" /></div>
            </div>
            <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-900">Quedará pendiente de pago: ${Math.max(0, officeTotalDue - (Number.isFinite(amountToPay) ? amountToPay : 0)).toLocaleString("es-CO")}</p>
            <Button onClick={handleGenerateOfficePayroll} disabled={isProcessing || !officeHours || !officeHourlyRate}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar nómina
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!selectedTechId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Nómina y liquidaciones</h1>
          <p className="text-muted-foreground font-medium">Gestión de pagos y revisión de historial consolidado.</p>
        </div>

        <Tabs defaultValue="liquidar" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-8 h-12 bg-slate-100 p-1">
            <TabsTrigger value="liquidar" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">LIQUIDAR TÉCNICOS</TabsTrigger>
            <TabsTrigger value="por-aprobar" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all">
              POR APROBAR {interventionsToApprove.length > 0 && <Badge className="ml-2 bg-white text-orange-600 h-4 px-1 text-[8px] animate-pulse">{interventionsToApprove.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="historial" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">HISTORIAL DE PAGOS</TabsTrigger>
          </TabsList>

          <TabsContent value="liquidar">
            <Card className="mb-6 border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-orange-600" /> Expedientes validados sin técnico
                  <Badge variant="secondary">{!cityFilter || isRequestsLoading ? "—" : paidRequestsWithoutTechnician.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Los reportes de carga masiva cuentan como referencias, no como asignación real de nómina, aunque tengan un nombre de técnico. Busca una ciudad para consultar y asignar cada servicio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!cityFilter ? (
                  <p className="text-sm text-muted-foreground">Busca una ciudad arriba para consultar los expedientes.</p>
                ) : isRequestsLoading ? (
                  <div className="flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : paidRequestsWithoutTechnician.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay expedientes validados pendientes de reporte y asignación.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Expediente</TableHead><TableHead>Asistencia / cuenta</TableHead><TableHead>Factura</TableHead><TableHead>Valor pagado</TableHead><TableHead>Servicio</TableHead><TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {paidRequestsWithoutTechnician.map(request => (
                          <TableRow key={request.id}>
                            <TableCell className="font-mono font-bold">{request.claimNumber}</TableCell>
                            <TableCell>{request.companyId} · {request.accountName}</TableCell>
                            <TableCell>{request.invoiceNumber || "—"}</TableCell>
                            <TableCell>{request.invoiceAmount ? `$${request.invoiceAmount.toLocaleString("es-CO")}` : "—"}</TableCell>
                            <TableCell>{request.invoiceServices || request.category}</TableCell>
                            <TableCell className="text-right">
                              <Button type="button" size="sm" onClick={() => {
                                setSelectedUnassignedRequest(request)
                                setPaidRequestTicket({
                                  technicianId: "",
                                  subservice: request.invoiceServices || request.serviceSubservice || request.category,
                                  report: "",
                                  invoiceAmount: request.invoiceAmount ? String(request.invoiceAmount) : "",
                                  materialsAmount: "0",
                                  deductionsAmount: "0",
                                  deductionsDescription: ""
                                })
                              }}>Crear ticket y asignar</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={!!selectedUnassignedRequest} onOpenChange={open => !open && setSelectedUnassignedRequest(null)}>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
                <DialogHeader>
                  <DialogTitle>Ticket y liquidación inicial</DialogTitle>
                  <DialogDescription>
                    Expediente {selectedUnassignedRequest?.claimNumber}. El saldo después de materiales y descuentos es la base a repartir según el porcentaje del técnico.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="paid-ticket-technician">Técnico asignado</Label>
                    <select id="paid-ticket-technician" value={paidRequestTicket.technicianId} onChange={event => setPaidRequestTicket(current => ({ ...current, technicianId: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Selecciona un técnico</option>
                      {allTechnicians.map(technician => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="paid-ticket-subservice">Subservicio</Label>
                    <Input id="paid-ticket-subservice" value={paidRequestTicket.subservice} onChange={event => setPaidRequestTicket(current => ({ ...current, subservice: event.target.value }))} placeholder="Trabajo realizado" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid-ticket-amount">Valor pagado de la factura</Label>
                    <Input id="paid-ticket-amount" type="number" min="1" step="1000" value={paidRequestTicket.invoiceAmount} onChange={event => setPaidRequestTicket(current => ({ ...current, invoiceAmount: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid-ticket-materials">Materiales a descontar</Label>
                    <Input id="paid-ticket-materials" type="number" min="0" step="1000" value={paidRequestTicket.materialsAmount} onChange={event => setPaidRequestTicket(current => ({ ...current, materialsAmount: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid-ticket-deductions">Adelantos / descuentos antes de repartir</Label>
                    <Input id="paid-ticket-deductions" type="number" min="0" step="1000" value={paidRequestTicket.deductionsAmount} onChange={event => setPaidRequestTicket(current => ({ ...current, deductionsAmount: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid-ticket-deduction-description">Detalle del adelanto / descuento</Label>
                    <Input id="paid-ticket-deduction-description" value={paidRequestTicket.deductionsDescription} onChange={event => setPaidRequestTicket(current => ({ ...current, deductionsDescription: event.target.value }))} placeholder="Requerido si hay descuento" />
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-900 sm:col-span-2">
                    Base para repartir: ${Math.max(0, (Number(paidRequestTicket.invoiceAmount) || 0) - (Number(paidRequestTicket.materialsAmount) || 0) - (Number(paidRequestTicket.deductionsAmount) || 0)).toLocaleString("es-CO")}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="paid-ticket-report">Reporte de lo realizado</Label>
                    <Textarea id="paid-ticket-report" rows={4} value={paidRequestTicket.report} onChange={event => setPaidRequestTicket(current => ({ ...current, report: event.target.value }))} placeholder="Describe el trabajo realizado para dejarlo como ticket del expediente." />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSelectedUnassignedRequest(null)}>Cancelar</Button>
                  <Button type="button" onClick={createValidatedRequestTicket} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar ticket y enviar a nómina
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <form
              className="mb-6 flex flex-col gap-2 sm:max-w-md"
              onSubmit={event => {
                event.preventDefault()
                setCityFilter(normalizePayrollCity(citySearchInput))
                setVisibleCityServiceCount(50)
              }}
            >
              <Label htmlFor="payroll-city-filter">Buscar expedientes por ciudad / municipio</Label>
              <div className="flex gap-2">
                <Input
                  id="payroll-city-filter"
                  value={citySearchInput}
                  onChange={event => setCitySearchInput(event.target.value)}
                  placeholder="Ejemplo: Pereira"
                  autoComplete="address-level2"
                />
                <Button type="submit" disabled={!citySearchInput.trim()}>Buscar</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Escribe la ciudad como aparece en los expedientes. Se consultan solo los de esa ciudad; tú verificas quién hizo cada servicio.
              </p>
            </form>

            {cityFilter && (
              <Card className="mb-6">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-base">Expedientes y servicios de {cityFilter}</CardTitle>
                    <CardDescription>
                      {cityServiceRows.length} registros encontrados. El técnico mostrado es el guardado en el reporte, no se asigna por ciudad.
                      Los reportes de carga masiva son informativos y no generan pagos por sí solos.
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={exportCityServicesExcel} disabled={isRequestsLoading || cityServiceRows.length === 0}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Descargar Excel
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Expediente</TableHead>
                          <TableHead>Técnico indicado</TableHead>
                          <TableHead>Servicio / reporte</TableHead>
                          <TableHead>Estado expediente</TableHead>
                          <TableHead className="text-right">Valor reportado</TableHead>
                          <TableHead>Disponibilidad</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isRequestsLoading ? (
                          <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary opacity-40" /></TableCell></TableRow>
                        ) : !allRequests ? (
                          <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Escribe una ciudad para consultar sus expedientes.</TableCell></TableRow>
                        ) : cityServiceRows.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No hay expedientes en esta ciudad.</TableCell></TableRow>
                        ) : cityServiceRows.slice(0, visibleCityServiceCount).map(({ request, intervention }, index) => {
                          const technicianId = intervention?.technicianId?.trim() || ""
                          const isPayable = !!intervention && !intervention.isPayrollExcluded &&
                            intervention.payrollStatus !== "processed" && canPayIntervention(request, intervention)
                          return (
                            <TableRow key={`${request.id}-${intervention?.id || "sin-reporte"}-${index}`}>
                              <TableCell className="font-mono font-bold">{request.claimNumber}</TableCell>
                              <TableCell className="font-semibold">
                                {technicianId ? getPayrollPersonName(technicianId) : "Sin técnico en el reporte"}
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <span className="block text-xs font-semibold">{intervention?.title || intervention?.subservice || request.serviceSubservice || request.category}</span>
                                <span className="block truncate text-xs text-muted-foreground" title={intervention?.notes || request.description}>
                                  {intervention?.notes || request.description || "Sin descripción"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs uppercase">
                                {request.status} · {request.billingStatus}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${(intervention?.reportedValue || 0).toLocaleString("es-CO")}
                              </TableCell>
                              <TableCell>
                                {intervention?.isPayrollExcluded ? (
                                  <Badge variant="outline">Solo referencia · no pagable</Badge>
                                ) : intervention?.payrollStatus === "processed" ? (
                                  <Badge variant="secondary">Ya liquidado</Badge>
                                ) : isPayable ? (
                                  <Badge className="bg-green-700">Listo para liquidar</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-orange-500 text-orange-700">Requiere autorización o cierre</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {technicianId && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedOfficeId(null)
                                      setSelectedTechId(canonicalTechnicianId(technicianId))
                                      setExcludedInterventionIds([])
                                      setExcludedAdvanceIds([])
                                      setExcludedDeductionTicketIds([])
                                      setDeductionTicketAmounts({})
                                    }}
                                  >
                                    Ver técnico
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {cityServiceRows.length > visibleCityServiceCount && (
                    <div className="flex justify-center border-t p-4">
                      <Button variant="outline" onClick={() => setVisibleCityServiceCount(count => count + 50)}>
                        Mostrar 50 registros más
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {visibleTechnicians.map((tech) => {
                const pending = pendingByTechnician.get(tech.id)!
                const payableServices = pending.interventions.filter(item => canPayIntervention(item.request, item.intervention)).length
                const servicesNeedingApproval = pending.interventions.length - payableServices
                return (
                  <Card key={tech.id} className="hover:shadow-md transition-shadow cursor-pointer group border-l-4 border-l-primary" onClick={() => { setSelectedOfficeId(null); setSelectedTechId(tech.id); setExcludedInterventionIds([]); setExcludedAdvanceIds([]); setExcludedDeductionTicketIds([]); setDeductionTicketAmounts({}) }}>
                    <CardHeader className="pb-4">
                      <Avatar className="h-12 w-12 mb-2"><AvatarImage src={`https://picsum.photos/seed/${tech.id}/100/100`} /><AvatarFallback>{tech.name.substring(0,2)}</AvatarFallback></Avatar>
                      <CardTitle className="text-lg font-black uppercase">{tech.name}</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase" title={tech.id}>
                        {tech.specialties.join(" • ")}{tech.name.startsWith("TÉCNICO SIN PERFIL") ? ` · ID: ${tech.id.slice(-6)}` : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <Button variant="ghost" className="text-xs font-bold p-0 group-hover:text-primary">Ver Liquidación <ChevronRight className="h-4 w-4" /></Button>
                        <div className="flex gap-1">
                          {pending.interventions.length > 0 && (
                            <Badge className="bg-orange-500" title={`${payableServices} listos para liquidar; ${servicesNeedingApproval} requieren autorización o cierre`}>
                              {payableServices} listos{servicesNeedingApproval > 0 ? ` · ${servicesNeedingApproval} por autorizar` : ""}
                            </Badge>
                          )}
                          {pending.advances.length > 0 && <Badge className="bg-destructive" title="Adelantos">${pending.advances.reduce((sum, item) => sum + (item.advance.amount || 0), 0).toLocaleString()}</Badge>}
                          {pending.tickets.length > 0 && <Badge variant="outline" title="Tickets de descuento">-${pending.tickets.reduce((sum, ticket) => sum + ticket.remainingAmount, 0).toLocaleString("es-CO")}</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {!cityFilter ? (
                <div className="col-span-full py-12 text-center text-muted-foreground italic border-2 border-dashed rounded-xl bg-slate-50">
                  Busca una ciudad para consultar expedientes y técnicos sin cargar toda la base de servicios.
                </div>
              ) : visibleTechnicians.length === 0 && !isRequestsLoading ? (
                <div className="col-span-full py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl bg-slate-50">
                  No hay técnicos con servicios, adelantos o descuentos pendientes de liquidar.
                </div>
              ) : null}
            </div>
            <Card className="mt-8 border-t-4 border-t-blue-500">
              <CardHeader>
                <CardTitle>Personal de oficina</CardTitle>
                <CardDescription>Selecciona al colaborador para calcular su nómina por horas y aplicar tickets pendientes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {officeStaff.map(person => {
                    const pendingAmount = (deductionTickets || [])
                      .filter(ticket => ticket.personType === "office" && ticket.personId === person.id && ticket.remainingAmount > 0)
                      .reduce((sum, ticket) => sum + ticket.remainingAmount, 0)
                    const pendingPay = (officePayrollHistory || [])
                      .filter(record => record.technicianId === person.id)
                      .reduce((sum, record) => sum + Math.max(0, record.pendingPaymentAmount || 0), 0)
                    return (
                      <button key={person.id} type="button" onClick={() => {
                        setSelectedOfficeId(person.id)
                        setOfficeHours("")
                        setOfficeHourlyRate("")
                        setOfficeAmountToPay("")
                        setOfficeTicketAmounts({})
                      }} className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5">
                        <span className="block font-bold uppercase">{person.name}</span>
                        <span className="text-xs text-muted-foreground">{person.role}</span>
                        {(pendingAmount > 0 || pendingPay > 0) && (
                          <span className="mt-2 flex flex-wrap gap-2">
                            {pendingAmount > 0 && <Badge variant="destructive">Descuentos ${pendingAmount.toLocaleString("es-CO")}</Badge>}
                            {pendingPay > 0 && <Badge variant="secondary">Nómina pendiente ${pendingPay.toLocaleString("es-CO")}</Badge>}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {officeStaff.length === 0 && <p className="text-sm text-muted-foreground">No hay perfiles activos de personal de oficina.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="por-aprobar">
            <Card className="shadow-xl border-t-4 border-t-orange-500">
              <CardHeader className="bg-slate-50/80 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider text-orange-700">
                  <Calculator className="h-4 w-4" /> Servicios Pendientes de Autorización
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">
                  {cityFilter ? `Servicios de ${cityFilter}. ` : ""}
                  Autoriza un servicio solo después de revisarlo; entonces quedará disponible para liquidación.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-black uppercase text-[10px]">Técnico / Personal</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Ciudad</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Servicio</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px]">Valor Reportado</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px]">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isRequestsLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                    ) : !cityFilter ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center italic text-muted-foreground">Busca una ciudad en la pestaña “Liquidar técnicos” para revisar sus servicios.</TableCell></TableRow>
                    ) : interventionsToApprove.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center italic text-muted-foreground">No hay servicios pendientes de aprobación.</TableCell></TableRow>
                    ) : interventionsToApprove.map((i: any) => (
                      <TableRow key={i.id} className="hover:bg-primary/5">
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <Avatar className="h-6 w-6"><AvatarImage src={`https://picsum.photos/seed/${i.technicianId}/50/50`} /><AvatarFallback>{i.technicianId.substring(0,2)}</AvatarFallback></Avatar>
                             <span className="font-black text-[10px] uppercase truncate max-w-[140px]" title={`${getPayrollPersonName(i.technicianId)} · ${i.technicianId}`}>{getPayrollPersonName(i.technicianId)}</span>
                          </div>
                        </TableCell>
                        <TableCell><span className="font-mono font-black text-primary text-xs">{i.request.claimNumber}</span></TableCell>
                        <TableCell className="text-xs font-semibold">{i.request.city || "Sin ciudad"}</TableCell>
                        <TableCell><span className="text-[10px] font-bold uppercase">{i.type}</span></TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-600">${i.reportedValue?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-orange-600 hover:bg-orange-700 font-black text-[9px] uppercase h-8 px-4"
                            onClick={() => handleApproveIntervention(i.request.id, i.id)}
                            disabled={isProcessing}
                          >
                            AUTORIZAR PAGO
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial">
            <Card className="shadow-md border-none overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black uppercase">Registros de Pago</CardTitle>
                  <CardDescription className="text-[10px] font-bold">Consolidado histórico de nóminas liquidadas.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    disabled={selectedHistoryItems.length === 0} 
                    onClick={() => {
                      const records = (payrollHistory || []).filter(r => selectedHistoryItems.includes(r.id))
                      generatePayrollPDF(records)
                    }}
                    className="bg-primary hover:bg-primary/90 font-black text-[10px] uppercase gap-2 h-10 shadow-lg"
                  >
                    <FileDown className="h-4 w-4" /> DESCARGAR PDF SELECCIONADOS ({selectedHistoryItems.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Referencia</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Técnico</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Estado Pago</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Neto Pagado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {isHistoryLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                    ) : payrollHistory?.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center italic text-muted-foreground">No se han realizado liquidaciones todavía.</TableCell></TableRow>
                    ) : payrollHistory.map((liq) => (
                      <TableRow key={liq.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <Checkbox 
                            checked={selectedHistoryItems.includes(liq.id)} 
                            onCheckedChange={(checked) => {
                              setSelectedHistoryItems(prev => checked ? [...prev, liq.id] : prev.filter(id => id !== liq.id))
                            }} 
                          />
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-mono font-black text-primary border-primary/20">{liq.id}</Badge></TableCell>
                        <TableCell><span className="font-bold uppercase text-xs">{getPayrollPersonName(liq.technicianId).toUpperCase()} {liq.employeeType === "office" && <Badge variant="outline">OFICINA</Badge>}</span>{(liq.pendingPaymentAmount || 0) > 0 && <span className="block text-[10px] text-destructive">Saldo pendiente: ${(liq.pendingPaymentAmount || 0).toLocaleString("es-CO")}</span>}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(liq.date).toLocaleDateString()}</span>
                            {liq.paymentMethod && <span className="text-xs text-muted-foreground">{liq.paymentMethod}{liq.paymentReference ? ` · ${liq.paymentReference}` : ""}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {liq.carriedToPayrollId ? (
                            <Badge variant="secondary" title={`Saldo trasladado a ${liq.carriedToPayrollId}`}>TRASLADADA</Badge>
                          ) : (
                            <button
                              onClick={() => handleTogglePaid(liq)}
                              title={liq.isPaid ? `Pagado el ${liq.paidAt ? new Date(liq.paidAt).toLocaleDateString() : ""}. Clic para marcar como pendiente` : "Clic para marcar como pagada"}
                              className="flex items-center gap-1 cursor-pointer"
                            >
                              {liq.isPaid
                                ? <Badge className="bg-green-500 hover:bg-green-600 text-white font-black text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />PAGADA</Badge>
                                : <Badge variant="outline" className="text-orange-500 border-orange-400 hover:bg-orange-50 font-black text-[10px] gap-1"><AlertCircle className="h-3 w-3" />PENDIENTE</Badge>
                              }
                            </button>
                          )}
                        </TableCell>
                         <TableCell className="text-right font-mono font-black text-green-600">${liq.netPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isDev && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePayroll(liq)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => generatePayrollPDF([liq])}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-[10px]" onClick={() => generateCollectionAccountPDF(liq)} aria-label={`Generar cuenta de cobro ${liq.id}`}>
                              <FileText className="h-3.5 w-3.5" /> Cuenta de cobro
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hasMoreHistory && (
                  <div className="flex justify-center border-t p-4">
                    <Button variant="outline" onClick={loadMoreHistory} disabled={isLoadingMoreHistory}>
                      {isLoadingMoreHistory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cargar 50 liquidaciones más
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => { setSelectedTechId(null); setExcludedInterventionIds([]); setExcludedAdvanceIds([]) }} className="rounded-lg border-primary text-primary"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-4 border-white shadow-lg"><AvatarImage src={`https://picsum.photos/seed/${selectedTechId}/100/100`} /></Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">{selectedTech?.name}</h1>
            <p className="text-muted-foreground text-sm">Liquidación detallada</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-white border shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground">Bruto</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">${totals.totalGross.toLocaleString()}</div></CardContent></Card>
            <Card className="bg-white border shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground">Materiales, alquileres y descuentos previos</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-destructive">-${(totals.totalExpenses + totals.totalRentals + totals.totalPreSplitDeductions).toLocaleString()}</div></CardContent></Card>
            <Card className="bg-white border shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground">Subtotal técnico</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-primary">${totals.technicianBase.toLocaleString()}</div></CardContent></Card>
            <Card className="bg-white border shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground">Adelantos y descuentos</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold text-destructive">-${totals.totalAdvances.toLocaleString()}</div></CardContent></Card>
          </div>

          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Desglose de servicios y descuentos</CardTitle>
                <CardDescription>
                  {cityFilter ? `Servicios de ${cityFilter}. ` : ""}
                  Los servicios sin autorización se muestran, pero no se incluyen en los importes.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {selectedInterventions.length + selectedAdvances.length + selectedTechnicianTickets.length} seleccionados · {pendingInterventions.filter(item => canPayIntervention(item.request, item)).length} servicios listos
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-wrap justify-end gap-2 px-4 pb-3">
                <Button type="button" variant="outline" size="sm" onClick={() => { setExcludedInterventionIds(pendingInterventions.map(item => item.id)); setExcludedAdvanceIds(pendingAdvances.map(item => item.id)); setExcludedDeductionTicketIds(pendingTechnicianTickets.map(item => item.id)) }}>Quitar selección</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setExcludedInterventionIds([]); setExcludedAdvanceIds([]); setExcludedDeductionTicketIds([]) }}>Seleccionar conceptos autorizados</Button>
                <Button type="button" variant="outline" size="sm" onClick={exportPayrollCSV} disabled={!selectedInterventions.length && !selectedAdvances.length}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar CSV</Button>
              </div>
              <Table>
                <TableHeader><TableRow className="bg-muted/30">
                  <TableHead className="w-16">Incluir</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Expediente / servicio</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Valor</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Materiales, alquileres y descuentos</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Total técnico editable</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingTechnicianTickets.map(ticket => {
                    const excluded = excludedDeductionTicketIds.includes(ticket.id)
                    const applied = excluded ? 0 : appliedTechnicianTickets.find(item => item.ticket.id === ticket.id)?.amount || 0
                    return (
                      <TableRow key={ticket.id} className={cn(!excluded && "bg-destructive/5")}>
                        <TableCell><Checkbox aria-label={`Incluir descuento ${ticket.description}`} checked={!excluded} onCheckedChange={checked => setExcludedDeductionTicketIds(ids => checked ? ids.filter(id => id !== ticket.id) : [...ids, ticket.id])} /></TableCell>
                        <TableCell><div className="flex flex-col"><span className="text-[10px] font-black text-destructive uppercase">TICKET DESCUENTO</span><span className="text-xs">{ticket.description}</span><span className="text-[8px] font-bold text-slate-400">Saldo: ${ticket.remainingAmount.toLocaleString("es-CO")}</span></div></TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive">-${ticket.remainingAmount.toLocaleString("es-CO")}</TableCell>
                        <TableCell className="text-right">---</TableCell>
                        <TableCell><Input aria-label={`Descuento aplicado para ${ticket.description}`} type="number" min="0" max={ticket.remainingAmount} value={deductionTicketAmounts[ticket.id] ?? applied} onChange={event => setDeductionTicketAmounts(current => ({ ...current, [ticket.id]: Number(event.target.value) }))} className="ml-auto w-32 text-right font-mono font-bold text-destructive" /></TableCell>
                      </TableRow>
                    )
                  })}
                  {pendingAdvances.map((adv) => (
                    <TableRow key={adv.id} className={cn(!excludedAdvanceIds.includes(adv.id) && "bg-destructive/5")}>
                      <TableCell><Checkbox aria-label={`Incluir anticipo ${adv.reason}`} checked={!excludedAdvanceIds.includes(adv.id)} onCheckedChange={(checked) => setExcludedAdvanceIds(ids => checked ? ids.filter(id => id !== adv.id) : [...ids, adv.id])} /></TableCell>
                      <TableCell><div className="flex flex-col"><span className="text-[10px] font-black text-destructive uppercase">ADELANTO: {adv.reason}</span><span className="text-[8px] font-bold text-slate-400">{adv.request.claimNumber}</span></div></TableCell>
                      <TableCell className="text-right font-mono font-bold text-destructive">-${adv.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">---</TableCell>
                      <TableCell className="text-right font-mono font-black text-destructive">-${adv.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {pendingInterventions.map((item: any) => {
                    const materialExpenses = (item.detailedExpenses || []).filter((e: any) => !e.isUnused).reduce((s: number, e: any) => s + (e.amount || 0), 0)
                    const isPayable = canPayIntervention(item.request, item)
                    const isExcluded = excludedInterventionIds.includes(item.id)
                    let rentals = 0
                    if (item.usedRotomartillo) rentals += 80000
                    if (item.usedGeofono) rentals += 120000
                    if (item.usedPlanchaTermofusion) rentals += 70000
                    const totalCosts = materialExpenses + rentals + (item.payrollDeductionAmount || 0)
                    const techNet = getPayrollAmount(item)
                    return (
                      <TableRow key={item.id} className={cn((isExcluded || !isPayable) && "opacity-60", !isExcluded && isPayable && item.isSimpleVisit && "bg-primary/5")}>
                        <TableCell><Checkbox aria-label={`Incluir servicio ${item.request.claimNumber}`} checked={isPayable && !isExcluded} disabled={!isPayable} onCheckedChange={(checked) => setExcludedInterventionIds(ids => checked ? ids.filter(id => id !== item.id) : [...ids, item.id])} /></TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-primary text-xs">{item.request.claimNumber}</span>
                            <span className="text-[10px] font-semibold">{item.request.category} · {item.subservice || item.request.serviceSubservice || item.type}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{item.isSimpleVisit ? "Visita" : item.type} · {item.request.city || "Sin ciudad"}</span>
                            <span className={cn("mt-1 text-[9px] font-black uppercase", isPayable ? "text-green-700" : "text-orange-700")}>
                              {isPayable ? "Listo para liquidar" : "Pendiente de autorización o cierre"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-700">${(item.reportedValue || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-destructive">
                          -${totalCosts.toLocaleString()}
                          {item.payrollDeductionAmount > 0 && <span className="block text-[9px]">Incluye ${item.payrollDeductionAmount.toLocaleString()} antes de repartir</span>}
                        </TableCell>
                        <TableCell><Input aria-label={`Valor liquidado para ${item.request.claimNumber}`} type="number" min="0" step="1000" value={manualPayrollAmounts[item.id] ?? techNet} onChange={event => {
                          const value = Number(event.target.value)
                          setManualPayrollAmounts(current => ({ ...current, [item.id]: Number.isFinite(value) ? Math.max(0, value) : 0 }))
                        }} className="ml-auto w-32 text-right font-mono font-bold text-primary" /></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-sm border-t-4 border-t-primary h-fit sticky top-24">
          <CardHeader className="pb-4"><CardTitle className="text-lg font-semibold flex items-center gap-2 text-primary"><Calculator className="h-5 w-5" /> Resumen de liquidación</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Porcentajes de {selectedTech?.name || "este técnico"}</p>
                <p className="text-xs text-muted-foreground">Se aplican sobre el saldo después de materiales, alquileres y descuentos antes de repartir.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="service-payroll-percent">Servicios (%)</Label><Input id="service-payroll-percent" type="number" min="0" max="100" value={servicePercentage} onChange={event => setServicePercentage(Number(event.target.value))} /></div>
                <div className="space-y-1"><Label htmlFor="visit-payroll-percent">Visitas (%)</Label><Input id="visit-payroll-percent" type="number" min="0" max="100" value={visitPercentage} onChange={event => setVisitPercentage(Number(event.target.value))} /></div>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleSavePayrollSettings} disabled={isSavingSettings}>
                {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar porcentajes
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-500"><span>Subtotal de servicios con porcentaje:</span><span className="font-mono">${totals.accumulatedToSplit.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs font-black text-primary border-t pt-2"><span>Total técnico antes de descuentos:</span><span className="font-mono">${totals.technicianBase.toLocaleString()}</span></div>
              
              <div className="pt-2 border-t border-dashed space-y-4">
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><HandCoins className="h-4 w-4 text-destructive" /><span className="text-[10px] font-black uppercase text-destructive">Adelantos y descuentos</span></div><span className="font-mono font-bold text-destructive">-${totals.totalAdvances.toLocaleString()}</span></div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Ajuste (+/-)</Label><Input type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(Number(e.target.value))} className="font-black h-9" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Motivo Ajuste</Label><Input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value.toUpperCase())} className="h-9 text-[10px]" /></div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-600"><MessageSquare className="h-3 w-3" /> Novedades / Notas de Nómina</Label>
                  <Textarea 
                    placeholder="Escriba aquí notas que aparecerán en el PDF..." 
                    className="min-h-[80px] text-xs font-medium"
                    value={payrollNotes}
                    onChange={(e) => setPayrollNotes(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 pt-3 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="payroll-payment-method">Método de pago</Label>
                    <select id="payroll-payment-method" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option>Transferencia</option>
                      <option>Consignación</option>
                      <option>Efectivo</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payroll-payment-reference">Referencia / comprobante</Label>
                    <Input id="payroll-payment-reference" value={paymentReference} onChange={event => setPaymentReference(event.target.value)} placeholder="Número o referencia de pago" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-primary/5 border border-primary/15 rounded-xl space-y-1"><p className="text-xs font-semibold text-muted-foreground">Gran total a pagar</p><p className="text-3xl font-bold text-primary">${totals.netPaid.toLocaleString()}</p></div>
            <Button className="w-full h-12 font-semibold" onClick={handleGeneratePayroll} disabled={isProcessing || (selectedInterventions.length === 0 && selectedAdvances.length === 0)}>{isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />} Finalizar y guardar liquidación</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
