
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { 
  MessageSquare, 
  X, 
  Send, 
  Users, 
  User as UserIcon, 
  Plus, 
  Search,
  ChevronLeft,
  Loader2,
  MoreVertical,
  CheckCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  updateDoc
} from "firebase/firestore"
import { cn } from "@/lib/utils"

type ChatRoom = {
  id: string
  type: 'direct' | 'group'
  participants: string[]
  name?: string
  lastMessage?: string
  lastMessageAt?: any
}

type Message = {
  id: string
  text: string
  senderId: string
  senderName: string
  timestamp: any
}

export function ChatWidget() {
  const { user } = useUser()
  const db = useFirestore()
  const [isOpen, setIsVisible] = useState(false)
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [selectedUsers, setSelectedGroupUsers] = useState<string[]>([])
  const [groupName, setGroupName] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, "user_profiles", user.uid)
  }, [db, user])
  const { data: myProfile } = useDoc(profileRef)

  // 1. Fetch Users
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: allUsers } = useCollection(usersQuery)

  // DEDUPLICATION & FILTER LOGIC: Restrict for Technicians
  const uniqueUsers = useMemo(() => {
    if (!allUsers || !myProfile) return []
    const uniqueMap = new Map()
    
    allUsers.forEach(u => {
      const uname = (u.username || "").toUpperCase().trim()
      if (!uname) return
      
      // Filter logic for technicians
      if (myProfile.roleId === 'Técnico') {
        const isRestricted = (u.firstName + ' ' + u.lastName).toUpperCase().includes('DANIEL CESPEDES')
        const isAllowedRole = u.roleId === 'Administrador' || u.roleId === 'Servicio al Cliente'
        if (!isAllowedRole || isRestricted) return
      }

      if (!uniqueMap.has(uname)) {
        uniqueMap.set(uname, u)
      } else {
        const existing = uniqueMap.get(uname)
        if (u.isActive && !existing.isActive) {
          uniqueMap.set(uname, u)
        }
      }
    })
    return Array.from(uniqueMap.values())
  }, [allUsers, myProfile])

  // 2. Fetch My Chats
  const chatsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "chats"), where("participants", "array-contains", user.uid))
  }, [db, user])
  const { data: myChats } = useCollection(chatsQuery)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Listen to messages for active chat
  useEffect(() => {
    if (!db || !activeChat) {
      setMessages([])
      return
    }

    const q = query(
      collection(db, "chats", activeChat.id, "messages"),
      orderBy("timestamp", "asc")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message))
      setMessages(msgs)
    })

    return () => unsubscribe()
  }, [db, activeChat])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !activeChat || !newMessage.trim()) return

    const messageData = {
      text: newMessage,
      senderId: user.uid,
      senderName: (myProfile?.firstName || "Usuario"),
      timestamp: serverTimestamp()
    }

    setNewMessage("")

    try {
      await addDoc(collection(db, "chats", activeChat.id, "messages"), messageData)
      await updateDoc(doc(db, "chats", activeChat.id), {
        lastMessage: newMessage,
        lastMessageAt: serverTimestamp()
      })
    } catch (err) {
      console.error("Error sending message:", err)
    }
  }

  const startDirectChat = async (targetUser: any) => {
    if (!db || !user) return

    const existing = myChats?.find(c => 
      c.type === 'direct' && 
      c.participants.includes(targetUser.id) && 
      c.participants.includes(user.uid)
    )

    if (existing) {
      setActiveChat(existing as ChatRoom)
      return
    }

    const chatId = [user.uid, targetUser.id].sort().join("_")
    const newChat: ChatRoom = {
      id: chatId,
      type: 'direct',
      participants: [user.uid, targetUser.id],
      lastMessageAt: serverTimestamp()
    }

    await setDoc(doc(db, "chats", chatId), newChat)
    setActiveChat(newChat)
  }

  const createGroup = async () => {
    if (!db || !user || !groupName || selectedUsers.length === 0) return

    const chatId = Math.random().toString(36).substring(7)
    const newChat: ChatRoom = {
      id: chatId,
      type: 'group',
      participants: [user.uid, ...selectedUsers],
      name: groupName.toUpperCase(),
      lastMessageAt: serverTimestamp()
    }

    await setDoc(doc(db, "chats", chatId), newChat)
    setActiveChat(newChat)
    setIsCreatingGroup(false)
    setSelectedGroupUsers([])
    setGroupName("")
  }

  if (!user || !myProfile) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      {isOpen && (
        <Card className="w-[350px] h-[550px] shadow-2xl border-none flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">
          {!activeChat ? (
            <>
              <CardHeader className="bg-primary text-primary-foreground p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle className="text-lg font-black uppercase tracking-tighter">Chat RYS</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8" onClick={() => setIsVisible(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary-foreground/60" />
                  <Input 
                    placeholder="Buscar colega..." 
                    className="h-9 pl-8 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 h-12 text-primary font-black uppercase text-[10px] tracking-widest border border-dashed border-primary/20 hover:bg-primary/5"
                      onClick={() => setIsCreatingGroup(true)}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-4 w-4" />
                      </div>
                      Crear nuevo grupo
                    </Button>

                    <div className="pt-2">
                      <p className="px-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Canales Activos</p>
                      {myChats?.filter(c => !searchTerm || (c.name || "").toLowerCase().includes(searchTerm.toLowerCase())).map(chat => {
                        const isGroup = chat.type === 'group'
                        const otherUserId = chat.participants.find((p: string) => p !== user.uid)
                        const otherUser = allUsers?.find(u => u.id === otherUserId)
                        
                        return (
                          <div 
                            key={chat.id} 
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer group transition-all"
                            onClick={() => setActiveChat(chat as ChatRoom)}
                          >
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                              <AvatarFallback className={isGroup ? "bg-accent text-white" : "bg-primary text-white"}>
                                {isGroup ? <Users className="h-4 w-4" /> : otherUser?.firstName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black truncate uppercase text-slate-800">
                                {isGroup ? chat.name : `${otherUser?.firstName} ${otherUser?.lastName}`}
                              </p>
                              <p className="text-xs text-muted-foreground truncate font-medium">{chat.lastMessage || "Pulsa para chatear"}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-2">
                      <p className="px-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Contactos Autorizados</p>
                      {uniqueUsers.filter(u => u.id !== user.uid && (!searchTerm || `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))).map(collab => (
                        <div 
                          key={collab.id} 
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer group transition-all"
                          onClick={() => startDirectChat(collab)}
                        >
                          <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                            <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
                              {collab.firstName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <p className="text-sm font-bold text-slate-800 uppercase">{collab.firstName} {collab.lastName}</p>
                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">{collab.roleId}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="bg-primary text-primary-foreground p-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="text-white h-8 w-8 hover:bg-white/10" onClick={() => setActiveChat(null)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-black uppercase truncate tracking-tight">
                      {activeChat.type === 'group' ? activeChat.name : allUsers?.find(u => u.id === activeChat.participants.find(p => p !== user.uid))?.firstName}
                    </CardTitle>
                    <p className="text-[8px] font-black uppercase text-white/60 tracking-widest">Chat Seguro RYS</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-white h-8 w-8 hover:bg-white/10" onClick={() => setIsVisible(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden bg-slate-50 relative">
                <ScrollArea className="h-full relative z-10">
                  <div className="p-4 space-y-4">
                    {messages.map((msg) => {
                      const isMe = msg.senderId === user.uid
                      return (
                        <div key={msg.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                          {!isMe && activeChat.type === 'group' && (
                            <span className="text-[8px] font-black uppercase text-muted-foreground ml-2 mb-1">{msg.senderName}</span>
                          )}
                          <div className={cn(
                            "px-4 py-2 rounded-2xl text-sm font-medium shadow-sm",
                            isMe 
                              ? "bg-primary text-primary-foreground rounded-tr-none" 
                              : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                          )}>
                            {msg.text}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="p-3 bg-white border-t relative z-10">
                <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                  <Input 
                    placeholder="Mensaje..." 
                    className="flex-1 bg-slate-100 border-none h-10 rounded-xl"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 rounded-xl shadow-lg" disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardFooter>
            </>
          )}
        </Card>
      )}

      <Button 
        className={cn(
          "h-16 w-16 rounded-full shadow-2xl transition-all duration-500 scale-100",
          isOpen ? "bg-slate-900 rotate-90" : "bg-primary"
        )}
        onClick={() => setIsVisible(!isOpen)}
      >
        {isOpen ? <X className="h-8 w-8" /> : <MessageSquare className="h-8 w-8" />}
      </Button>

      <Dialog open={isCreatingGroup} onOpenChange={setIsCreatingGroup}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-primary tracking-tighter">Nuevo Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Nombre del Grupo</Label>
              <Input 
                placeholder="EJ: TECNICOS PLOMERIA" 
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="font-black h-12 uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Integrantes</Label>
              <ScrollArea className="h-[200px] border rounded-xl p-2 bg-slate-50">
                <div className="space-y-2">
                  {uniqueUsers.filter(u => u.id !== user.uid).map(collab => (
                    <div key={collab.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded-lg transition-colors">
                      <Checkbox 
                        id={collab.id} 
                        checked={selectedUsers.includes(collab.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedGroupUsers([...selectedUsers, collab.id])
                          else setSelectedGroupUsers(selectedUsers.filter(id => id !== collab.id))
                        }}
                      />
                      <Label htmlFor={collab.id} className="flex items-center gap-3 cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold uppercase">{collab.firstName} {collab.lastName}</span>
                          <span className="text-[8px] font-black uppercase text-muted-foreground">{collab.roleId}</span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsCreatingGroup(false)} className="font-bold">CANCELAR</Button>
            <Button 
              className="font-black uppercase tracking-widest shadow-lg bg-primary hover:bg-primary/90" 
              onClick={createGroup}
              disabled={!groupName || selectedUsers.length === 0}
            >
              CREAR GRUPO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
