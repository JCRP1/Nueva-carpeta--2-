"use client"

import React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Leaf, Eye, EyeOff, Loader2, Shield, Wrench, Sprout } from "lucide-react"
import type { User } from "@/lib/greensense-data"
import { api } from "@/lib/api-client"

const quickAccess = [
  { email: "carlos@greensense.io", password: "admin123", nombre: "Carlos Martinez", rol: "administrador" as const },
  { email: "maria@greensense.io", password: "tecnico123", nombre: "Maria Lopez", rol: "tecnico" as const },
  { email: "juan@greensense.io", password: "agri123", nombre: "Juan Perez", rol: "agricultor" as const },
]

interface LoginViewProps {
  onLogin: (user: User) => void
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [view, setView] = useState<"login" | "forgot">("login")
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotSent, setForgotSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email || !password) {
      setError("Complete todos los campos")
      return
    }
    setLoading(true)
    try {
      const res = await api.login(email, password)
      onLogin(res.user as unknown as User)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion")
      setLoading(false)
    }
  }

  async function handleQuickLogin(cred: typeof quickAccess[number]) {
    setEmail(cred.email)
    setPassword(cred.password)
    setLoading(true)
    setError("")
    try {
      const res = await api.login(cred.email, cred.password)
      onLogin(res.user as unknown as User)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion. Ejecute npm run db:seed primero.")
      setLoading(false)
    }
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setForgotSent(true)
      setLoading(false)
    }, 1000)
  }

  const roleIcons = {
    administrador: Shield,
    tecnico: Wrench,
    agricultor: Sprout,
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Leaf className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">GreenSense</h1>
            <p className="text-sm text-muted-foreground">Sistema de Fertirriego Inteligente</p>
          </div>
        </div>

        {view === "login" ? (
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Iniciar Sesion</h2>
              <p className="text-sm text-muted-foreground">
                Ingrese sus credenciales para acceder al sistema
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Correo Electronico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@greensense.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contrasena</Label>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Olvido su contrasena?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingrese su contrasena"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ingresando...
                    </>
                  ) : (
                    "Ingresar"
                  )}
                </Button>
              </form>

              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Acceso rapido demo:</p>
                {quickAccess.map((cred) => {
                  const RIcon = roleIcons[cred.rol]
                  return (
                    <button
                      key={cred.email}
                      type="button"
                      onClick={() => handleQuickLogin(cred)}
                      disabled={loading}
                      className="flex items-center gap-3 rounded-lg border border-dashed p-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                    >
                      <RIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{cred.nombre}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{cred.rol} - {cred.email}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Recuperar Contrasena</h2>
              <p className="text-sm text-muted-foreground">
                Ingrese su correo para recibir un enlace de recuperacion
              </p>
            </CardHeader>
            <CardContent>
              {forgotSent ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Leaf className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-center text-sm text-foreground">
                    Se ha enviado un enlace de recuperacion a <strong>{forgotEmail}</strong>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setView("login")
                      setForgotSent(false)
                      setForgotEmail("")
                    }}
                  >
                    Volver al Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="forgot-email">Correo Electronico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="usuario@greensense.io"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loading || !forgotEmail} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar Enlace"
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setView("login")} type="button">
                    Volver al Login
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Invernadero Pedro Castillo - San Jose de Ocoa
        </p>
      </div>
    </div>
  )
}
