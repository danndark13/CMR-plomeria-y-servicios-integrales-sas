"use client"

import { useMemo, useState } from "react"
import { collection, doc, setDoc, updateDoc } from "firebase/firestore"
import { ArrowLeft, Loader2, Save, TicketPercent } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { PayrollDeductionTicket } from "@/lib/types"

const OFFICE_ROLES = new Set(["Administrador", "Gerente", "Desarrollador", "Contabilidad", "Servicio al Cliente"])

type StaffProfile = {
  id: string
  username?: string
  firstName?: string
  lastName?: string
  roleId?: string
  isActive?: boolean
}

export default function PayrollTicketsPage() {
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()
  const [personType, setPersonType] = useState<"technician" | "office">("technician")
  const [personId, setPersonId] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const profileRef = useMemoFirebase(() => user && db ? doc(db, "user_profiles", user.uid) : null, [user, db])
  const { data: profile } = useDoc(profileRef)
  const usersQuery = useMemoFirebase(() => user && db ? collection(db, "user_profiles") : null, [user, db])
  const { data: users } = useCollection<StaffProfile>(usersQuery)
  const ticketsQuery = useMemoFirebase(() => user && db ? collection(db, "payroll_deduction_tickets") : null, [user, db])
  const { data: tickets } = useCollection<PayrollDeductionTicket>(ticketsQuery)

  const isAdmin = ["Administrador", "Gerente", "Desarrollador"].includes(profile?.roleId || "")
  const people = useMemo(() => {
    const uniquePeople = new Map<string, { id: string; name: string; role: string }>()
    ;(users || [])
      .filter(person => person.isActive !== false && (
        personType === "technician"
          ? person.roleId === "Técnico"
          : OFFICE_ROLES.has(person.roleId || "")
      ))
      .forEach(person => {
        const id = personType === "technician" ? (person.username || person.id).toUpperCase().trim() : person.id
        const name = `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.username || person.id
        const existing = uniquePeople.get(id)
        if (!existing || name.length > existing.name.length) {
          uniquePeople.set(id, { id, name, role: person.roleId || (personType === "technician" ? "Técnico" : "Personal de oficina") })
        }
      })
    return Array.from(uniquePeople.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [users, personType])

  const createTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedPerson = people.find(person => person.id === personId)
    const numericAmount = Number(amount)
    if (!db || !selectedPerson || !date || !description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Completa los datos del ticket", description: "Selecciona una persona, fecha, descripción y un valor mayor que cero." })
      return
    }
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const ticket: PayrollDeductionTicket = {
      id,
      personId: selectedPerson.id,
      personName: selectedPerson.name,
      personType,
      date: new Date(`${date}T12:00:00`).toISOString(),
      description: description.trim(),
      amount: numericAmount,
      remainingAmount: numericAmount,
      createdAt: now,
      updatedAt: now
    }
    setIsSaving(true)
    try {
      await setDoc(doc(db, "payroll_deduction_tickets", id), ticket)
      toast({ title: "Ticket de descuento creado", description: `${selectedPerson.name}: $${numericAmount.toLocaleString("es-CO")}` })
      setPersonId("")
      setDescription("")
      setAmount("")
      setDate(new Date().toISOString().slice(0, 10))
    } catch (error) {
      console.error("Creating payroll deduction ticket failed:", error)
      const errorCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
      toast({
        variant: "destructive",
        title: "No se pudo crear el ticket",
        description: errorCode === "permission-denied"
          ? "Firestore denegó el permiso. Publica firestore.rules en el proyecto Firebase conectado y vuelve a intentar."
          : error instanceof Error ? error.message : "Verifica permisos y conexión."
      })
    } finally {
      setIsSaving(false)
    }
  }

  const cancelTicket = async (ticket: PayrollDeductionTicket) => {
    if (!db || ticket.remainingAmount !== ticket.amount) return
    try {
      await updateDoc(doc(db, "payroll_deduction_tickets", ticket.id), { remainingAmount: 0, cancelledAt: new Date().toISOString() })
      toast({ title: "Ticket cancelado", description: "El descuento ya no aparecerá en próximas nóminas." })
    } catch (error) {
      console.error("Cancelling payroll deduction ticket failed:", error)
      toast({ variant: "destructive", title: "No se pudo cancelar el ticket", description: error instanceof Error ? error.message : "Verifica permisos y conexión." })
    }
  }

  if (!isAdmin) {
    return <Card><CardContent className="p-10 text-center">No tienes permiso para crear tickets de descuento.</CardContent></Card>
  }

  const openTickets = (tickets || []).filter(ticket => ticket.remainingAmount > 0).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Regresar"><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-black text-primary">Crear ticket descuento</h1>
          <p className="text-sm text-muted-foreground">Registra adelantos o descuentos para técnicos y personal de oficina.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TicketPercent className="h-5 w-5 text-primary" /> Nuevo descuento o adelanto</CardTitle>
          <CardDescription>El saldo no descontado se conserva y se podrá aplicar en siguientes nóminas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTicket} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-person-type">Tipo de persona</Label>
              <select id="ticket-person-type" value={personType} onChange={event => { setPersonType(event.target.value as "technician" | "office"); setPersonId("") }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="technician">Técnico</option>
                <option value="office">Personal de oficina</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-person">Técnico / staff</Label>
              <select id="ticket-person" required value={personId} onChange={event => setPersonId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecciona a quién se hará el ticket</option>
                {people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-date">Fecha</Label>
              <Input id="ticket-date" type="date" required value={date} onChange={event => setDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-amount">Valor</Label>
              <Input id="ticket-amount" type="number" min="1" step="1" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="$ 0" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ticket-description">Descripción</Label>
              <Textarea id="ticket-description" required value={description} onChange={event => setDescription(event.target.value)} placeholder="Motivo del adelanto o descuento" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isSaving || people.length === 0}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Crear ticket
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Descuentos pendientes</CardTitle><CardDescription>Los saldos parciales se mantienen para la siguiente liquidación.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {openTickets.length === 0 && <p className="text-sm text-muted-foreground">No hay tickets pendientes.</p>}
          {openTickets.map(ticket => (
            <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{ticket.personName}</span>
                  <Badge variant="outline">{ticket.personType === "technician" ? "Técnico" : "Oficina"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{ticket.description} · {new Date(ticket.date).toLocaleDateString("es-CO")}</p>
                <p className="text-xs">Original: ${ticket.amount.toLocaleString("es-CO")} · Saldo: <strong>${ticket.remainingAmount.toLocaleString("es-CO")}</strong></p>
              </div>
              {ticket.remainingAmount === ticket.amount && <Button type="button" variant="outline" size="sm" onClick={() => void cancelTicket(ticket)}>Cancelar ticket</Button>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
