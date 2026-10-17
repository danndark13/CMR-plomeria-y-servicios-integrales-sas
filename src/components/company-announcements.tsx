"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { collection, doc } from "firebase/firestore"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { CompanyAnnouncement } from "@/lib/types"

const LOGIN_SESSION_KEY = "rys-login-session"
const SHOWN_SESSION_KEY = "rys-announcements-shown-session"

export function CompanyAnnouncements() {
  const db = useFirestore()
  const { user } = useUser()
  const [now, setNow] = useState(() => Date.now())
  const [loginSession, setLoginSession] = useState("")
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<CompanyAnnouncement[]>([])
  const profileRef = useMemoFirebase(() => db && user ? doc(db, "user_profiles", user.uid) : null, [db, user])
  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)
  const announcementsQuery = useMemoFirebase(() => db && user ? collection(db, "announcements") : null, [db, user])
  const { data: announcements, isLoading } = useCollection<CompanyAnnouncement>(announcementsQuery)
  const sortedAnnouncements = useMemo(
    () => [...(announcements || [])]
      .filter(announcement => !announcement.expiresAt || new Date(announcement.expiresAt).getTime() > now)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [announcements, now]
  )
  const activeVisibleAnnouncements = visibleAnnouncements.filter(announcement =>
    !announcement.expiresAt || new Date(announcement.expiresAt).getTime() > now
  )

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (user) {
      let session = window.sessionStorage.getItem(LOGIN_SESSION_KEY)
      if (!session) {
        session = crypto.randomUUID()
        window.sessionStorage.setItem(LOGIN_SESSION_KEY, session)
      }
      setLoginSession(session)
    } else {
      setLoginSession("")
      setVisibleAnnouncements([])
    }
  }, [user])

  useEffect(() => {
    if (!user || isProfileLoading || isLoading || !loginSession) return
    if (window.sessionStorage.getItem(SHOWN_SESSION_KEY) === loginSession) return
    window.sessionStorage.setItem(SHOWN_SESSION_KEY, loginSession)
    setVisibleAnnouncements(sortedAnnouncements)
  }, [user, isProfileLoading, isLoading, loginSession, sortedAnnouncements])

  const closeAnnouncements = () => setVisibleAnnouncements([])

  return (
    <Dialog open={activeVisibleAnnouncements.length > 0} onOpenChange={open => { if (!open) closeAnnouncements() }}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 [&>button]:hidden" aria-describedby="company-announcement-description">
        <div className="flex items-center justify-between border-b bg-slate-950 px-6 py-4 text-white">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-black uppercase tracking-wide">Comunicados de la empresa</DialogTitle>
            <DialogDescription id="company-announcement-description" className="text-white/70">
              Avisos vigentes para el personal.
            </DialogDescription>
          </DialogHeader>
          <Button type="button" variant="ghost" size="icon" onClick={closeAnnouncements} aria-label="Cerrar comunicados" className="shrink-0 text-white hover:bg-white/15 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-h-[calc(90vh-96px)] space-y-5 overflow-y-auto p-6">
          {activeVisibleAnnouncements.map(announcement => (
            <article key={announcement.id} className="space-y-3 border-b pb-5 last:border-0 last:pb-0">
              <h2 className="text-xl font-black text-slate-900">{announcement.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{announcement.message}</p>
              {announcement.imageDataUrl && (
                <Image src={announcement.imageDataUrl} alt="" width={1200} height={800} unoptimized className="max-h-80 w-full rounded-lg border object-contain" />
              )}
              {announcement.expiresAt && (
                <p className="text-xs font-semibold text-slate-500">
                  Vigente hasta {new Date(announcement.expiresAt).toLocaleString("es-CO")}
                </p>
              )}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
