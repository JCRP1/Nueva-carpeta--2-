"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2, TriangleAlert } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"

interface ResetPasswordViewProps {
  token: string
}

export function ResetPasswordView({ token }: ResetPasswordViewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [valid, setValid] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setValid(false)
      return
    }

    api
      .validateResetPasswordToken(token)
      .then((res) => {
        setValid(Boolean(res.valid))
        setEmail(String(res.email || ""))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo validar el enlace")
        setValid(false)
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden")
      return
    }

    setSaving(true)
    try {
      await api.resetPassword(token, password)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contrasena")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="pb-4">
            <h1 className="text-lg font-semibold text-card-foreground">Restablecer contrasena</h1>
            <p className="text-sm text-muted-foreground">
              Cree una nueva contrasena para volver a entrar al sistema.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Validando enlace...
              </div>
            ) : success ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Contrasena actualizada</p>
                  <p className="text-sm text-muted-foreground">
                    Ya puede iniciar sesion con su nueva contrasena.
                  </p>
                </div>
                <Button onClick={() => router.push("/")}>Ir al login</Button>
              </div>
            ) : !valid ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <TriangleAlert className="h-10 w-10 text-amber-500" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Enlace invalido o expirado</p>
                  <p className="text-sm text-muted-foreground">
                    Solicite un nuevo enlace de recuperacion desde el login o desde usuarios.
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button variant="outline" onClick={() => router.push("/")}>Volver</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  Correo: <span className="font-medium text-foreground">{email}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Nueva contrasena</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 8 caracteres"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Confirmar contrasena</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la contrasena"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Actualizar contrasena"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
