"use client"

import { useMemo, useState } from "react"
import { collection, doc, setDoc } from "firebase/firestore"
import { ArrowLeft, Loader2, Plus, Receipt } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { CompanyExpense } from "@/lib/types"

const EXPENSE_CATEGORIES = ["Internet", "Mantenimiento", "Servicios públicos", "Arriendo", "Transporte", "Otros"]

export default function AccountingExpensesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState("Internet")
  const [description, setDescription] = useState("")
  const [vendor, setVendor] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const profileRef = useMemoFirebase(() => db && user ? doc(db, "user_profiles", user.uid) : null, [db, user])
  const { data: profile } = useDoc(profileRef)
  const expenseQuery = useMemoFirebase(() => db && user ? collection(db, "company_expenses") : null, [db, user])
  const { data: expenses, isLoading } = useCollection<CompanyExpense>(expenseQuery)

  const canManageExpenses = ["Administrador", "Gerente", "Desarrollador", "Contabilidad"].includes(profile?.roleId || "")

  const saveExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!db || !user || !date || !category || !description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Revisa los datos del gasto", description: "La descripción, fecha y valor mayor que cero son obligatorios." })
      return
    }
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const expense: CompanyExpense = {
      id,
      date: new Date(`${date}T12:00:00`).toISOString(),
      category,
      description: description.trim(),
      amount: numericAmount,
      ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      createdAt: now,
      updatedAt: now,
      createdBy: profile?.username || user.uid
    }
    setIsSaving(true)
    try {
      await setDoc(doc(db, "company_expenses", id), expense)
      toast({ title: "Gasto agregado al Balance" })
      setDescription("")
      setVendor("")
      setAmount("")
      setNotes("")
      setDate(new Date().toISOString().slice(0, 10))
    } catch (error) {
      console.error("Saving company expense failed:", error)
      toast({ variant: "destructive", title: "No se pudo guardar el gasto", description: error instanceof Error ? error.message : "Verifica los permisos y la conexión." })
    } finally {
      setIsSaving(false)
    }
  }

  const sortedExpenses = useMemo(
    () => [...(expenses || [])].sort((left, right) => right.date.localeCompare(left.date)),
    [expenses]
  )

  if (!canManageExpenses) {
    return <Card><CardContent className="p-10 text-center">No tienes permiso para registrar gastos de la empresa.</CardContent></Card>
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Regresar"><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-black text-primary">Gastos de la empresa</h1>
          <p className="text-sm text-muted-foreground">Registra internet, mantenimientos y otros gastos para el Balance General.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Nuevo gasto</CardTitle>
          <CardDescription>Los registros se conservan y se incluyen en los egresos según su fecha.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveExpense} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input id="expense-date" type="date" value={date} onChange={event => setDate(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-category">Categoría</Label>
              <select id="expense-category" value={category} onChange={event => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {EXPENSE_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="expense-description">Descripción</Label>
              <Input id="expense-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Ej. Plan de internet oficina" required maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-vendor">Proveedor (opcional)</Label>
              <Input id="expense-vendor" value={vendor} onChange={event => setVendor(event.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Valor</Label>
              <Input id="expense-amount" type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="expense-notes">Notas (opcional)</Label>
              <Textarea id="expense-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Guardar gasto
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Historial</CardTitle>
          <CardDescription>Todos los registros se conservan para consulta y cálculo del balance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
            sortedExpenses.length ? sortedExpenses.map(expense => (
              <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-bold">{expense.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(expense.date).toLocaleDateString("es-CO")} · {expense.category}
                    {expense.vendor ? ` · ${expense.vendor}` : ""}
                  </p>
                  {expense.notes && <p className="mt-1 text-xs text-muted-foreground">{expense.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">${expense.amount.toLocaleString("es-CO")}</Badge>
                </div>
              </div>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay gastos registrados.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
