"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { api, fetcher } from "@/lib/api-client"
import type { Cultivo, UserRole } from "@/lib/greensense-data"
import { getAllCultivos, getPerfilAgronomico } from "@/lib/cultivos-rd-data"
import { Loader2, Save, Sprout } from "lucide-react"
import { toast } from "sonner"

type CultivoReferencia = ReturnType<typeof getAllCultivos>[number]

type ZoneData = {
  id: string
  nombre: string
  cultivoActual: string
  umbralHumedad: number
  umbral_ph: number
  umbral_ec: number
  umbral_tds: number
  fechaSiembra: string
  fechaCosechaEstimada: string
  tiempoGerminacionDias: number
  tiempoCrecimientoDias: number
  tiempoCosechaDias: number
  cantidadCultivo: number
  fertilizanteEstimado?: string
  abonoEstimado?: string
  recomendacionSiembra?: string
  notasCultivo: string
}

type PlantingViewProps = {
  selectedGreenhouse: string
  userRole: UserRole
}

function getReferenceAsCrop(reference: CultivoReferencia): Cultivo {
  return {
    id: `catalogo-${reference.nombre}`,
    nombre: reference.nombre,
    variedad: reference.variedad,
    invernaderoId: "",
    fechaSiembra: "",
    umbralHumedad: reference.etapas.crecimiento?.umbral_humedad,
    umbralPh: reference.etapas.crecimiento?.umbral_ph,
    umbralEc: reference.etapas.crecimiento?.umbral_ec,
    umbralTds: reference.etapas.crecimiento?.umbral_tds,
    esCatalogo: true,
    detalle: {
      id: `catalogo-${reference.nombre}-detalle`,
      fechaCosechaEstimada: "",
      tiempoGerminacionDias: reference.germinacion,
      tiempoCrecimientoDias: reference.crecimiento,
      tiempoCosechaDias: reference.cosecha,
      umbralHumedad: reference.etapas.crecimiento?.umbral_humedad,
      umbralPh: reference.etapas.crecimiento?.umbral_ph,
      umbralEc: reference.etapas.crecimiento?.umbral_ec,
      umbralTds: reference.etapas.crecimiento?.umbral_tds,
      notas: "",
    },
  }
}

function getCropCycle(cropName: string, fechaSiembra: string) {
  const crop = getAllCultivos().find((item) => item.nombre.toLowerCase() === cropName.toLowerCase())
  if (!crop) {
    return {
      fechaCosechaEstimada: "",
      tiempoGerminacionDias: 0,
      tiempoCrecimientoDias: 0,
      tiempoCosechaDias: 0,
      notasCultivo: "",
    }
  }

  let fechaCosechaEstimada = ""
  if (fechaSiembra && crop.duracion) {
    const date = new Date(`${fechaSiembra}T00:00:00`)
    date.setDate(date.getDate() + crop.duracion)
    fechaCosechaEstimada = date.toISOString().slice(0, 10)
  }

  return {
    fechaCosechaEstimada,
    tiempoGerminacionDias: crop.germinacion,
    tiempoCrecimientoDias: crop.crecimiento,
    tiempoCosechaDias: crop.cosecha,
    notasCultivo: `Duracion total: ${crop.duracion} dias`,
  }
}

function getCropThresholds(crop?: Cultivo) {
  return {
    umbralHumedad: crop?.umbralHumedad ?? crop?.detalle?.umbralHumedad ?? 40,
    umbral_ph: crop?.umbralPh ?? crop?.detalle?.umbralPh ?? 6,
    umbral_ec: crop?.umbralEc ?? crop?.detalle?.umbralEc ?? 1.5,
    umbral_tds: crop?.umbralTds ?? crop?.detalle?.umbralTds ?? 800,
  }
}

function formatList(value?: string[] | string | null) {
  if (Array.isArray(value)) return value.join(", ")
  return String(value || "").replace(/\n+/g, ", ")
}

export function PlantingView({ selectedGreenhouse, userRole }: PlantingViewProps) {
  const canEdit = userRole === "administrador" || userRole === "tecnico"
  const [zoneId, setZoneId] = useState("")
  const [cultivo, setCultivo] = useState("")
  const [fechaSiembra, setFechaSiembra] = useState("")
  const [fechaCosecha, setFechaCosecha] = useState("")
  const [germinacion, setGerminacion] = useState(0)
  const [crecimiento, setCrecimiento] = useState(0)
  const [cosecha, setCosecha] = useState(0)
  const [cantidad, setCantidad] = useState(0)
  const [notas, setNotas] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: zones, isLoading, mutate } = useSWR<ZoneData[]>(
    selectedGreenhouse ? `/api/zones?greenhouse=${selectedGreenhouse}` : null,
    fetcher,
    { refreshInterval: 5000 }
  )
  const { data: crops } = useSWR<Cultivo[]>(
    selectedGreenhouse ? `/api/crops?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )

  const zoneList = zones || []
  const selectedZone = zoneList.find((zone) => zone.id === zoneId) || zoneList[0]

  const cropOptions = useMemo(() => {
    const byName = new Map<string, Cultivo>()
    for (const crop of crops || []) {
      const key = crop.nombre.trim().toLowerCase()
      if (key) byName.set(key, crop)
    }
    for (const reference of getAllCultivos()) {
      const key = reference.nombre.trim().toLowerCase()
      if (key && !byName.has(key)) byName.set(key, getReferenceAsCrop(reference))
    }
    return Array.from(byName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [crops])

  const selectedCrop = cropOptions.find((crop) => crop.nombre === cultivo)
  const profile = cultivo ? getPerfilAgronomico(cultivo) : null
  const thresholds = getCropThresholds(selectedCrop)

  useEffect(() => {
    if (!selectedZone) return
    setZoneId(selectedZone.id)
    setCultivo(selectedZone.cultivoActual || "")
    setFechaSiembra(selectedZone.fechaSiembra || "")
    setFechaCosecha(selectedZone.fechaCosechaEstimada || "")
    setGerminacion(selectedZone.tiempoGerminacionDias || 0)
    setCrecimiento(selectedZone.tiempoCrecimientoDias || 0)
    setCosecha(selectedZone.tiempoCosechaDias || 0)
    setCantidad(selectedZone.cantidadCultivo || 0)
    setNotas(selectedZone.notasCultivo || "")
  }, [selectedZone])

  function applyCrop(cropName: string) {
    setCultivo(cropName)
    const cycle = getCropCycle(cropName, fechaSiembra)
    setGerminacion(cycle.tiempoGerminacionDias)
    setCrecimiento(cycle.tiempoCrecimientoDias)
    setCosecha(cycle.tiempoCosechaDias)
    if (cycle.fechaCosechaEstimada) setFechaCosecha(cycle.fechaCosechaEstimada)
    if (cycle.notasCultivo) setNotas(cycle.notasCultivo)
  }

  function updatePlantingDate(value: string) {
    setFechaSiembra(value)
    const cycle = getCropCycle(cultivo, value)
    if (cycle.fechaCosechaEstimada) setFechaCosecha(cycle.fechaCosechaEstimada)
  }

  async function handleSave() {
    if (!selectedZone) {
      toast.error("Seleccione una zona")
      return
    }
    if (!cultivo) {
      toast.error("Seleccione un cultivo")
      return
    }

    setSaving(true)
    try {
      await api.updateZone(selectedZone.id, {
        cultivoActual: cultivo,
        ...thresholds,
        fechaSiembra: fechaSiembra || null,
        fechaCosechaEstimada: fechaCosecha || null,
        tiempoGerminacionDias: germinacion || null,
        tiempoCrecimientoDias: crecimiento || null,
        tiempoCosechaDias: cosecha || null,
        cantidadCultivo: cantidad,
        humedadSiembra: thresholds.umbralHumedad,
        phSiembra: thresholds.umbral_ph,
        ecSiembra: thresholds.umbral_ec,
        tdsSiembra: thresholds.umbral_tds,
        fertilizanteEstimado: formatList(profile?.fertilizantes) || selectedCrop?.fertilizantes || "",
        abonoEstimado: formatList(profile?.abonos) || selectedCrop?.abonos || "",
        recomendacionSiembra: formatList(profile?.mesesRecomendados) || selectedCrop?.recomendacionSiembra || "",
        notasCultivo: notas,
      })
      await mutate()
      toast.success("Siembra guardada", { description: selectedZone.nombre })
    } catch (err) {
      toast.error("Error al guardar siembra", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading && !zones) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Siembra</h2>
          <p className="text-sm text-muted-foreground">Registre el cultivo y los datos de siembra por zona.</p>
        </div>
        <Badge variant="outline">{zoneList.length} zonas</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sprout className="h-5 w-5 text-primary" />
              Datos de siembra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Zona de riego</Label>
                <Select value={selectedZone?.id || ""} onValueChange={setZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneList.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Cultivo</Label>
                <Select value={cultivo} onValueChange={applyCrop} disabled={!selectedZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cultivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cropOptions.map((crop) => (
                      <SelectItem key={crop.id} value={crop.nombre}>
                        {crop.nombre} {crop.variedad ? `(${crop.variedad})` : ""}
                        {crop.esCatalogo ? " - Catalogo" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Fecha de siembra</Label>
                <Input type="date" value={fechaSiembra} onChange={(event) => updatePlantingDate(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Fecha cosecha estimada</Label>
                <Input type="date" value={fechaCosecha} onChange={(event) => setFechaCosecha(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Germinacion (dias)</Label>
                <Input type="number" min={0} value={germinacion} onChange={(event) => setGerminacion(Number(event.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Crecimiento (dias)</Label>
                <Input type="number" min={0} value={crecimiento} onChange={(event) => setCrecimiento(Number(event.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Cosecha (dias)</Label>
                <Input type="number" min={0} value={cosecha} onChange={(event) => setCosecha(Number(event.target.value))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cantidad a sembrar</Label>
                <Input type="number" min={0} step={1} value={cantidad} onChange={(event) => setCantidad(Number(event.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>TDS objetivo</Label>
                <Input type="number" min={0} step={1} value={thresholds.umbral_tds} readOnly />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notas del cultivo en esta zona</Label>
              <Textarea value={notas} onChange={(event) => setNotas(event.target.value)} placeholder="Notas de siembra, etapa o manejo..." />
            </div>

            <Button onClick={handleSave} disabled={!canEdit || saving || !selectedZone} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />Guardar siembra
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referencia agronomica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Humedad: {thresholds.umbralHumedad}%</p>
              <p>pH: {thresholds.umbral_ph}</p>
              <p>EC: {thresholds.umbral_ec}</p>
              <p>TDS: {thresholds.umbral_tds}</p>
              <p>Fertilizantes: {formatList(profile?.fertilizantes) || selectedCrop?.fertilizantes || "No definido"}</p>
              <p>Abonos: {formatList(profile?.abonos) || selectedCrop?.abonos || "No definido"}</p>
              <p>Meses recomendados: {formatList(profile?.mesesRecomendados) || selectedCrop?.mejoresMeses || "No definido"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
