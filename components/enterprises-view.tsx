"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Building2,
  Loader2,
  Save,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { toast } from "sonner"

interface Empresa {
  id_empresa: number
  nombre: string
  rnc?: string
  direccion?: string
  telefono?: string
  correo?: string
  estado?: string
  fecha_creacion?: string
}

export function EnterprisesView() {
  const { data: empresas, isLoading, mutate } = useSWR<Empresa[]>("/api/empresas", fetcher)
  
  const [formData, setFormData] = useState({
    nombre: "",
    rnc: "",
    direccion: "",
    telefono: "",
    correo: ""
  })
  const [originalData, setOriginalData] = useState({
    nombre: "",
    rnc: "",
    direccion: "",
    telefono: "",
    correo: "",
    estado: "Activa"
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)

  const empresaList = empresas || []
  const empresa = empresaList[0]

  function formatRNC(value: string): string {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 9)
    if (clean.length > 8) return clean.slice(0,3) + "-" + clean.slice(3,8) + "-" + clean.slice(8)
    if (clean.length > 3) return clean.slice(0,3) + "-" + clean.slice(3)
    return clean
  }

  useEffect(() => {
    if (empresa) {
      const data = {
        nombre: empresa.nombre || "",
        rnc: formatRNC(empresa.rnc || ""),
        direccion: empresa.direccion || "",
        telefono: empresa.telefono || "",
        correo: empresa.correo || "",
        estado: empresa.estado || "Activa",
      }
      setFormData(data)
      setOriginalData({...data, rnc: formatRNC(data.rnc)})
      setHasChanges(false)
    }
  }, [empresa])

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  async function handleSave() {
    if (!formData.nombre.trim()) {
      toast.error("El nombre de la empresa es requerido")
      return
    }
    if (!empresa) {
      toast.error("No hay empresa para editar")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/empresas/${empresa.id_empresa}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nombre: formData.nombre.trim(), 
          rnc: formData.rnc.trim(),
          direccion: formData.direccion.trim(),
          telefono: formData.telefono.trim(),
          correo: formData.correo.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al actualizar empresa")
      } else {
        toast.success("Empresa actualizada exitosamente")
        mutate()
        setOriginalData({
          nombre: formData.nombre.trim(), 
          rnc: formData.rnc.trim(),
          direccion: formData.direccion.trim(),
          telefono: formData.telefono.trim(),
          correo: formData.correo.trim(),
          estado: originalData.estado,
        })
        setHasChanges(false)
      }
    } catch (err) {
      toast.error("Error al actualizar empresa")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gestion de Empresa</h2>
          <p className="text-sm text-muted-foreground">
            Configure los datos de la empresa
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No hay empresa registrada</p>
            <p className="text-sm text-muted-foreground">Cree una empresa desde la base de datos</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gestion de Empresa</h2>
          <p className="text-sm text-muted-foreground">
            Configure los datos de la empresa
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />Guardar cambios</>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Nombre de la Empresa *</Label>
              <Input
                placeholder="Nombre de la empresa"
                value={formData.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>RNC</Label>
              <Input
                placeholder="123-45678-9"
                value={formData.rnc}
                onChange={(e) => updateField("rnc", formatRNC(e.target.value))}
                maxLength={11}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Direccion</Label>
              <Input
                placeholder="Direccion"
                value={formData.direccion}
                onChange={(e) => updateField("direccion", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Telefono</Label>
              <Input
                placeholder="Telefono"
                value={formData.telefono}
                onChange={(e) => updateField("telefono", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Correo</Label>
              <Input
                type="email"
                placeholder="correo@empresa.com"
                value={formData.correo}
                onChange={(e) => updateField("correo", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
