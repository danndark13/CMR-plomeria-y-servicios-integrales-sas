"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { collection, deleteDoc, doc, setDoc } from "firebase/firestore"
import { ArrowLeft, ImagePlus, Loader2, Megaphone, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { CompanyAnnouncement } from "@/lib/types"

const MAX_IMAGE_BYTES = 700 * 1024

async function prepareAnnouncementImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen.")
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen original no puede superar 8 MB.")
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No fue posible preparar la imagen.")
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (let quality = 0.82; quality >= 0.3; quality -= 0.1) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality)
      const encodedBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4)
      if (encodedBytes <= MAX_IMAGE_BYTES) return dataUrl
    }
    throw new Error("La imagen no se puede reducir lo suficiente. Selecciona una imagen más pequeña.")
  } finally {
    bitmap.close()
  }
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [imageDataUrl, setImageDataUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const profileRef = useMemoFirebase(() => db && user ? doc(db, "user_profiles", user.uid) : null, [db, user])
  const { data: profile } = useDoc(profileRef)
  const announcementsQuery = useMemoFirebase(() => db && user ? collection(db, "announcements") : null, [db, user])
  const { data: announcements, isLoading } = useCollection<CompanyAnnouncement>(announcementsQuery)
  const canManage = ["Gerente", "Desarrollador"].includes(profile?.roleId || "")
  const sortedAnnouncements = useMemo(
    () => [...(announcements || [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [announcements]
  )

  const selectImage = async (file?: File) => {
    if (!file) {
      setImageDataUrl("")
      return
    }
    try {
      setImageDataUrl(await prepareAnnouncementImage(file))
    } catch (error) {
      console.error("Preparing announcement image failed:", error)
      toast({ variant: "destructive", title: "No se pudo agregar la imagen", description: error instanceof Error ? error.message : "Selecciona otra imagen." })
    }
  }

  const createAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db || !user || !title.trim() || !message.trim()) {
      toast({ variant: "destructive", title: "Completa el título y el mensaje" })
      return
    }
    const expiration = expiresAt ? new Date(expiresAt) : null
    if (expiration && (!Number.isFinite(expiration.getTime()) || expiration.getTime() <= Date.now())) {
      toast({ variant: "destructive", title: "La fecha de vencimiento debe ser futura" })
      return
    }
    const id = crypto.randomUUID()
    const announcement: CompanyAnnouncement = {
      id,
      title: title.trim(),
      message: message.trim(),
      ...(imageDataUrl ? { imageDataUrl } : {}),
      ...(expiration ? { expiresAt: expiration.toISOString() } : {}),
      createdAt: new Date().toISOString(),
      createdBy: profile?.username || user.uid,
      createdByName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || profile?.username || "Gerencia"
    }
    setIsSaving(true)
    try {
      await setDoc(doc(db, "announcements", id), announcement)
      toast({ title: "Noticia publicada", description: "Aparecerá al iniciar sesión hasta que venza o sea eliminada." })
      setTitle("")
      setMessage("")
      setExpiresAt("")
      setImageDataUrl("")
    } catch (error) {
      console.error("Creating announcement failed:", error)
      toast({ variant: "destructive", title: "No se pudo publicar la noticia", description: error instanceof Error ? error.message : "Verifica los permisos y la conexión." })
    } finally {
      setIsSaving(false)
    }
  }

  const removeAnnouncement = async (announcement: CompanyAnnouncement) => {
    if (!db || !window.confirm(`¿Eliminar la noticia “${announcement.title}”? Dejará de mostrarse al iniciar sesión.`)) return
    setBusyId(announcement.id)
    try {
      await deleteDoc(doc(db, "announcements", announcement.id))
      toast({ title: "Noticia eliminada" })
    } catch (error) {
      console.error("Deleting announcement failed:", error)
      toast({ variant: "destructive", title: "No se pudo eliminar la noticia", description: error instanceof Error ? error.message : "Verifica los permisos y la conexión." })
    } finally {
      setBusyId(null)
    }
  }

  if (!canManage) {
    return <Card><CardContent className="p-10 text-center">Solo Gerencia y Desarrollo pueden publicar o eliminar noticias.</CardContent></Card>
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Regresar"><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-primary"><Megaphone className="h-6 w-6" /> Noticias emergentes</h1>
          <p className="text-sm text-muted-foreground">Se muestran al iniciar sesión. Cerrarlas no las elimina.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publicar noticia</CardTitle>
          <CardDescription>Sin vencimiento, la noticia seguirá visible hasta que Gerencia o Desarrollo la elimine.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createAnnouncement} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="announcement-title">Título</Label>
              <Input id="announcement-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-message">Mensaje</Label>
              <Textarea id="announcement-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={4000} className="min-h-28" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="announcement-expires">Vence el (opcional)</Label>
                <Input id="announcement-expires" type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-image">Imagen (opcional, máximo 8 MB original)</Label>
                <Input id="announcement-image" type="file" accept="image/*" onChange={event => void selectImage(event.target.files?.[0])} />
              </div>
            </div>
            {imageDataUrl && (
              <div className="relative max-h-72 overflow-hidden rounded-lg border">
                <Image src={imageDataUrl} alt="Vista previa de la noticia" width={1200} height={700} unoptimized className="h-auto max-h-72 w-full object-contain" />
                <Button type="button" variant="outline" size="sm" className="absolute right-2 top-2" onClick={() => setImageDataUrl("")}>Quitar imagen</Button>
              </div>
            )}
            <Button type="submit" disabled={isSaving} className="w-full md:w-fit">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Publicar noticia
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Noticias publicadas</CardTitle>
          <CardDescription>Las vencidas ya no aparecen a los usuarios, pero permanecen aquí hasta que se eliminen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
            sortedAnnouncements.length ? sortedAnnouncements.map(announcement => {
              const expired = !!announcement.expiresAt && new Date(announcement.expiresAt).getTime() <= Date.now()
              return (
                <div key={announcement.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black">{announcement.title}</h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{announcement.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Publicó {announcement.createdByName} · {new Date(announcement.createdAt).toLocaleString("es-CO")}
                        {announcement.expiresAt ? ` · Vence ${new Date(announcement.expiresAt).toLocaleString("es-CO")}` : " · Sin vencimiento"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={expired ? "secondary" : "default"}>{expired ? "VENCIDA" : "ACTIVA"}</Badge>
                      <Button type="button" variant="outline" size="icon" aria-label={`Eliminar ${announcement.title}`} disabled={busyId === announcement.id} onClick={() => void removeAnnouncement(announcement)}>
                        {busyId === announcement.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    </div>
                  </div>
                  {announcement.imageDataUrl && (
                    <Image src={announcement.imageDataUrl} alt="" width={1000} height={500} unoptimized className="mt-3 max-h-64 w-full rounded-md border object-contain" />
                  )}
                </div>
              )
            }) : <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><ImagePlus className="h-4 w-4" />Aún no hay noticias publicadas.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
