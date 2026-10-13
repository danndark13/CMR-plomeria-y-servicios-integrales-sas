"use client"

import { ChangeEvent, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore"
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { AssistanceCompany, CostSheetItem } from "@/lib/types"
import { MOCK_COMPANIES } from "@/lib/mock-data"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

const UNITS = ["UND", "KG", "LB", "MTS", "M2", "M3", "CM", "GL", "GAL", "LT", "BASE", "PAR", "PQ", "VIAJE", "ROLLO", "CAJA", "BOLSA"]

type CostSheetDraft = {
  kind: CostSheetItem["kind"]
  description: string
  unit: string
  value: string
  assistanceCompanyId: string
}

type ImportCostDraft = Omit<CostSheetItem, "id" | "code">

const EMPTY_DRAFT: CostSheetDraft = {
  kind: "service",
  description: "",
  unit: "UND",
  value: "",
  assistanceCompanyId: ""
}
const REQUIRED_ASSISTANCES = [
  { id: "MAWDY", name: "MAWDY" },
  { id: "IGS", name: "IGS" },
  { id: "IKE", name: "IKE" },
  { id: "AXA", name: "AXA" },
  { id: "FIXIT", name: "FIXIT" },
  { id: "ASSISPREX", name: "ASSISPREX" },
  { id: "PARTICULAR", name: "PARTICULAR" }
] as const
const MATERIALS_ASSISTANCE_ID = "__SHARED_MATERIALS__"

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const codePrefix = (kind: CostSheetItem["kind"], assistanceName?: string) => {
  if (kind === "material") return "MAT"
  const firstWord = normalize(assistanceName).toUpperCase().match(/[A-Z]+/)?.[0] || "SRV"
  return firstWord.slice(0, 3)
}

export default function CostSheetsPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [draft, setDraft] = useState<CostSheetDraft>(EMPTY_DRAFT)
  const [filterKind, setFilterKind] = useState<"all" | CostSheetItem["kind"]>("all")
  const [search, setSearch] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [importMessage, setImportMessage] = useState("")
  const [importPreview, setImportPreview] = useState<ImportCostDraft[] | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

  const profileRef = useMemoFirebase(() => user && db ? doc(db, "user_profiles", user.uid) : null, [user, db])
  const { data: profile } = useDoc(profileRef)
  const canManage = ["Administrador", "Gerente", "Desarrollador", "Contabilidad"].includes(profile?.roleId || "")

  const itemsQuery = useMemoFirebase(() => db && user ? collection(db, "cost_sheet_items") : null, [db, user])
  const { data: items, isLoading, error: itemsError } = useCollection<CostSheetItem>(itemsQuery)
  const companiesQuery = useMemoFirebase(() => db && user ? collection(db, "assistance_companies") : null, [db, user])
  const { data: companies } = useCollection(companiesQuery)
  const assistanceOptions = useMemo(() => {
    const available = [...(companies || []), ...MOCK_COMPANIES]
    const required: AssistanceCompany[] = REQUIRED_ASSISTANCES.map(assistance => {
      const existing = available.find(company =>
        normalize(company.id) === normalize(assistance.id) ||
        normalize(company.name) === normalize(assistance.name) ||
        normalize(company.name).startsWith(`${normalize(assistance.name)} `)
      )
      return existing || { ...assistance, accounts: [] }
    })
    return [...required, { id: MATERIALS_ASSISTANCE_ID, name: "MATERIALES (COMPARTIDO)", accounts: [] }]
  }, [companies])

  const visibleItems = useMemo(() => (items || []).filter(item =>
    (filterKind === "all" || item.kind === filterKind) &&
    item.description.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.description.localeCompare(b.description)), [items, filterKind, search])

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return "Compartido"
    return assistanceOptions.find(company => company.id === companyId)?.name || "Asistencia"
  }

  const generateCode = (kind: CostSheetItem["kind"], assistanceCompanyId?: string, reservedCodes: Set<string> = new Set()) => {
    const prefix = codePrefix(kind, assistanceOptions.find(company => company.id === assistanceCompanyId)?.name)
    const existing = (items || []).map(item => item.code || "").concat(Array.from(reservedCodes))
    const max = existing.reduce((highest, code) => {
      const match = code.match(new RegExp(`^${prefix}(\\d+)$`, "i"))
      return match ? Math.max(highest, Number(match[1])) : highest
    }, 0)
    return `${prefix}${String(max + 1).padStart(kind === "material" ? 4 : 3, "0")}`
  }

  const saveItem = async () => {
    if (!db || !canManage) return
    const value = Number(draft.value)
    if (!draft.description.trim() || !Number.isFinite(value) || value <= 0 || (draft.kind === "service" && !draft.assistanceCompanyId)) {
      toast({ variant: "destructive", title: "Revisa los datos", description: "Descripción, valor y asistencia para servicios son obligatorios." })
      return
    }
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const code = generateCode(draft.kind, draft.assistanceCompanyId)
      await addDoc(collection(db, "cost_sheet_items"), {
        code,
        kind: draft.kind,
        description: draft.description.trim(),
        unit: draft.unit,
        value,
        ...(draft.kind === "service" ? { assistanceCompanyId: draft.assistanceCompanyId } : {}),
        createdAt: now,
        updatedAt: now
      })
      setDraft(EMPTY_DRAFT)
      toast({ title: "Ítem agregado a la hoja de costos", description: `Código asignado: ${code}` })
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
      const message = error instanceof Error ? error.message : "Error desconocido de Firestore."
      if (code === "permission-denied") {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "cost_sheet_items",
          operation: "create",
          requestResourceData: {
            code: generateCode(draft.kind, draft.assistanceCompanyId),
            kind: draft.kind,
            description: draft.description.trim(),
            unit: draft.unit,
            value,
            ...(draft.kind === "service" ? { assistanceCompanyId: draft.assistanceCompanyId } : {})
          }
        }))
      }
      toast({ variant: "destructive", title: "No se pudo guardar el ítem", description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const importWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !db || !canManage) return
    setIsSaving(true)
    setImportMessage("")
    setImportPreview(null)
    setImportErrors([])
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      if (!rows.length) throw new Error("El archivo no contiene filas para importar.")

      const companyNames = new Map(assistanceOptions.filter(company => company.id !== MATERIALS_ASSISTANCE_ID).flatMap(company => [
        [normalize(company.name), company.id] as const,
        [normalize(company.id), company.id] as const
      ]))
      const errors: string[] = []
      const prepared = rows.flatMap((row, index) => {
        const values = new Map(Object.entries(row).map(([key, value]) => [normalize(key), value]))
        const description = String(values.get("descripcion") ?? values.get("description") ?? "").trim()
        const kindRaw = normalize(values.get("tipo") ?? values.get("type") ?? "")
        const kind: CostSheetItem["kind"] | null = ["material", "materiales", "mat"].includes(kindRaw) ? "material" : ["servicio", "servicios", "service"].includes(kindRaw) ? "service" : null
        const unit = String(values.get("unidad") ?? values.get("unit") ?? "UND").trim().toUpperCase()
        const valueRaw = values.get("valor") ?? values.get("value") ?? values.get("precio")
        const numericValue = typeof valueRaw === "number" ? valueRaw : Number(String(valueRaw).replace(/[.$\s]/g, "").replace(",", "."))
        const assistanceName = normalize(values.get("asistencia") ?? values.get("assistance") ?? values.get("empresa") ?? "")
        const assistanceCompanyId = companyNames.get(assistanceName)
        if (!description || !kind || !UNITS.includes(unit) || !Number.isFinite(numericValue) || numericValue <= 0 || (kind === "service" && !assistanceCompanyId)) {
          errors.push(`Fila ${index + 2}: revisa descripción, tipo, unidad, valor y asistencia obligatoria para los servicios.`)
          return []
        }
        return [{
          kind,
          description,
          unit,
          value: numericValue,
          ...(kind === "service" ? { assistanceCompanyId } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })
      if (prepared.length > 450) throw new Error("La carga admite hasta 450 filas válidas por planilla. Divide el archivo y carga el siguiente bloque.")
      if (!prepared.length) throw new Error(errors[0] || "No hay filas válidas en el archivo.")
      setImportPreview(prepared)
      setImportErrors(errors)
      setImportMessage(`${prepared.length} filas válidas listas para revisar.${errors.length ? ` ${errors.length} filas tienen errores y no se cargarán.` : ""}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de lectura o guardado del archivo."
      setImportMessage(message)
      toast({ variant: "destructive", title: "No se pudo importar", description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new()
    const template = XLSX.utils.aoa_to_sheet([["tipo", "asistencia", "descripcion", "unidad", "valor"]])
    const instructions = XLSX.utils.aoa_to_sheet([
      ["Columna", "Uso"],
      ["tipo", "servicio o material"],
      ["asistencia", "Nombre o código de la asistencia; obligatorio para servicios. Materiales se comparten y dejan esta celda vacía."],
      ["descripcion", "Nombre del servicio o material"],
      ["unidad", UNITS.join(", ")],
      ["valor", "Valor numérico sin símbolo de moneda"],
      ["código", "No se diligencia: el CMR asigna el código automáticamente."]
    ])
    XLSX.utils.book_append_sheet(workbook, template, "Costos")
    XLSX.utils.book_append_sheet(workbook, instructions, "Instrucciones")
    XLSX.writeFile(workbook, "Plantilla_hoja_de_costos.xlsx")
  }

  const confirmImport = async () => {
    if (!db || !canManage || !importPreview?.length) return
    setIsSaving(true)
    try {
      const reservedCodes = new Set<string>()
      const collectionRef = collection(db, "cost_sheet_items")
      const prepared = importPreview.map(item => {
        const code = generateCode(item.kind, item.assistanceCompanyId, reservedCodes)
        reservedCodes.add(code)
        return { ...item, code }
      })
      const batch = writeBatch(db)
      prepared.forEach(item => batch.set(doc(collectionRef), item))
      await batch.commit()
      const summary = `${prepared.length} costos cargados.${importErrors.length ? ` ${importErrors.length} filas inválidas fueron omitidas.` : ""}`
      setImportMessage(summary)
      setImportPreview(null)
      setImportErrors([])
      toast({ title: "Hoja de costos importada", description: summary })
    } catch (error) {
      console.error("Error importing cost sheet:", error)
      toast({ variant: "destructive", title: "No se pudo completar la carga", description: error instanceof Error ? error.message : "Verifica permisos y conexión con Firestore." })
    } finally {
      setIsSaving(false)
    }
  }
  const updateValue = async (item: CostSheetItem, value: number) => {
    if (!db || !canManage || !Number.isFinite(value) || value <= 0) return
    try {
      await updateDoc(doc(db, "cost_sheet_items", item.id), { value, updatedAt: new Date().toISOString() })
    } catch (error) {
      toast({ variant: "destructive", title: "No se pudo actualizar el precio", description: error instanceof Error ? error.message : "Error desconocido de Firestore." })
    }
  }

  const backfillCodes = async () => {
    if (!db || !items) return
    const missingCodes = items.filter(item => !item.code)
    if (!missingCodes.length) return
    setIsSaving(true)
    try {
      const reservedCodes = new Set((items || []).map(item => item.code).filter((code): code is string => !!code))
      for (let offset = 0; offset < missingCodes.length; offset += 450) {
        const batch = writeBatch(db)
        missingCodes.slice(offset, offset + 450).forEach(item => {
          const code = generateCode(item.kind, item.assistanceCompanyId, reservedCodes)
          reservedCodes.add(code)
          batch.update(doc(db, "cost_sheet_items", item.id), { code, updatedAt: new Date().toISOString() })
        })
        await batch.commit()
      }
      toast({ title: "Códigos asignados", description: `${missingCodes.length} costos existentes recibieron código sin cambiar su precio o descripción.` })
    } catch (error) {
      console.error("Error assigning codes to existing cost items:", error)
      toast({ variant: "destructive", title: "No se pudieron completar los códigos", description: error instanceof Error ? error.message : "Verifica permisos y conexión." })
    } finally {
      setIsSaving(false)
    }
  }

  const removeItem = async (item: CostSheetItem) => {
    if (!db || !canManage) return
    try {
      await deleteDoc(doc(db, "cost_sheet_items", item.id))
      toast({ title: "Ítem eliminado de la hoja de costos" })
    } catch (error) {
      toast({ variant: "destructive", title: "No se pudo eliminar el ítem", description: error instanceof Error ? error.message : "Error desconocido de Firestore." })
    }
  }

  if (!canManage && profile) return <Card><CardContent className="p-8 text-sm text-muted-foreground">No tienes permisos para administrar las hojas de costos.</CardContent></Card>

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Hojas de costos</h1>
          <p className="text-sm text-muted-foreground">Tarifas por asistencia y materiales compartidos entre todas las cuentas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Descargar plantilla</Button>
          {canManage && items?.some(item => !item.code) && <Button type="button" variant="outline" onClick={backfillCodes} disabled={isSaving}><FileSpreadsheet className="mr-2 h-4 w-4" />Asignar códigos faltantes</Button>}
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#f36f3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e65e2b]">
            <Upload className="h-4 w-4" />Cargar planilla
            <Input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importWorkbook} disabled={isSaving} />
          </Label>
        </div>
      </div>

      {itemsError && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex gap-3 p-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">No se pudieron leer las hojas de costos desde Firestore.</p><p className="mt-1">Las reglas locales permiten listar esta colección a usuarios autenticados. Este error suele indicar que las reglas no están publicadas o que la app está conectada a otro proyecto Firebase.</p></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar costo</CardTitle>
          <CardDescription>Las tarifas de servicios pertenecen a una asistencia; los materiales son comunes a todas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={draft.kind} onValueChange={kind => setDraft({ ...draft, kind: kind as CostSheetDraft["kind"], assistanceCompanyId: kind === "material" ? "" : draft.assistanceCompanyId })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="service">Servicio</SelectItem><SelectItem value="material">Material</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="cost-description">Descripción</Label>
            <Input id="cost-description" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Geófono, exploración, tubería..." />
          </div>
          {draft.kind === "service" && (
            <div className="space-y-1">
              <Label>Asistencia</Label>
              <Select value={draft.assistanceCompanyId} onValueChange={assistanceCompanyId => {
                if (assistanceCompanyId === MATERIALS_ASSISTANCE_ID) {
                  setDraft({ ...draft, kind: "material", assistanceCompanyId: "" })
                } else {
                  setDraft({ ...draft, assistanceCompanyId })
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {assistanceOptions.map(company => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Unidad</Label>
            <Select value={draft.unit} onValueChange={unit => setDraft({ ...draft, unit })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost-value">Valor</Label>
            <Input id="cost-value" type="number" min="1" value={draft.value} onChange={event => setDraft({ ...draft, value: event.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={saveItem} disabled={isSaving} className="w-full"><Plus className="mr-2 h-4 w-4" />Agregar ítem</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
          <div><CardTitle className="text-base">Tarifado</CardTitle><CardDescription>Los cambios de precio se aplican a los tickets que se creen en adelante.</CardDescription></div>
          <div className="flex gap-2">
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar costo..." className="w-48" />
            <Select value={filterKind} onValueChange={value => setFilterKind(value as typeof filterKind)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="service">Servicios</SelectItem><SelectItem value="material">Materiales</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {importMessage && <p className="mb-3 text-sm text-muted-foreground">{importMessage}</p>}
          {importPreview && (
            <div className="mb-4 space-y-3 rounded-xl border border-[#d9e0ed] bg-[#f6f8fc] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold text-[#263b5a]">Revisión antes de cargar</p><p className="text-xs text-muted-foreground">{importPreview.length} filas válidas · se asignarán códigos automáticamente.</p></div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setImportPreview(null)} disabled={isSaving}>Cancelar</Button>
                  <Button type="button" onClick={confirmImport} disabled={isSaving} className="bg-[#f36f3d] text-white hover:bg-[#e65e2b]">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Cargar {importPreview.length} costos
                  </Button>
                </div>
              </div>
              {importErrors.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><p className="mb-1 font-semibold">{importErrors.length} filas no se cargarán:</p><ul className="list-inside list-disc space-y-1">{importErrors.slice(0, 8).map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>{importErrors.length > 8 && <p className="mt-1">Y {importErrors.length - 8} filas más.</p>}</div>}
              <div className="max-h-56 overflow-auto rounded-lg border bg-white">
                <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Asistencia</TableHead><TableHead>Descripción</TableHead><TableHead>Unidad</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
                  <TableBody>{importPreview.slice(0, 10).map((item, index) => <TableRow key={`${item.description}-${index}`}><TableCell>{item.kind === "material" ? "Material" : "Servicio"}</TableCell><TableCell>{getCompanyName(item.assistanceCompanyId)}</TableCell><TableCell>{item.description}</TableCell><TableCell>{item.unit}</TableCell><TableCell>${item.value.toLocaleString("es-CO")}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              {importPreview.length > 10 && <p className="text-[11px] text-muted-foreground">Mostrando 10 de {importPreview.length} filas válidas.</p>}
            </div>
          )}
          {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Tipo</TableHead><TableHead>Asistencia</TableHead><TableHead>Descripción</TableHead><TableHead>Unidad</TableHead><TableHead className="w-44">Valor</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                <TableBody>
                  {visibleItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-bold text-[#5b7db7]">{item.code || "—"}</TableCell>
                      <TableCell><Badge variant={item.kind === "material" ? "secondary" : "outline"}>{item.kind === "material" ? "Material" : "Servicio"}</Badge></TableCell>
                      <TableCell>{getCompanyName(item.assistanceCompanyId)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell><Input type="number" min="1" defaultValue={item.value} onBlur={event => {
                        const value = Number(event.target.value)
                        if (value !== item.value) void updateValue(item, value)
                      }} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => void removeItem(item)} aria-label={`Eliminar ${item.description}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {visibleItems.length === 0 && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground"><FileSpreadsheet className="mx-auto mb-2 h-6 w-6 opacity-40" />No hay costos para mostrar.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
