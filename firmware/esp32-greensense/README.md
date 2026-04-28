# GreenSense ESP32 PlatformIO

Firmware para ESP32 que lee un sensor analogico en GPIO34 y envia la lectura a GreenSense.

## Configurar

Edita `src/main.cpp`:

- `WIFI_SSID` y `WIFI_PASSWORD`
- `API_URL`: IP LAN de la PC donde corre Next.js, por ejemplo `http://192.168.1.10:3000/api/iot/readings`
- `IOT_API_KEY`: debe coincidir con `.env`
- `CODIGO_DISPOSITIVO`: debe existir en GreenSense
- `SENSOR_TIPO`: debe coincidir con el sensor asociado al dispositivo

## Subir

```bash
pio run -t upload
pio device monitor
```

El monitor debe mostrar `HTTP 200` cuando la API guarda la lectura.

## Usarlo desde este workspace

Este repo no tiene `platformio.ini` en la raiz. El proyecto PlatformIO real vive en:

`firmware/esp32-greensense`

Opciones:

```bash
C:\Users\puell\.platformio\penv\Scripts\pio.exe run -e esp32dev
C:\Users\puell\.platformio\penv\Scripts\pio.exe run -e esp32dev -t upload
C:\Users\puell\.platformio\penv\Scripts\pio.exe device monitor -b 115200
```

O usa las tareas de VS Code:

- `PlatformIO: Build ESP32`
- `PlatformIO: Upload ESP32`
- `PlatformIO: Monitor ESP32`

Si necesitas fijar el puerto serial, descomenta `upload_port` y `monitor_port` en `platformio.ini`.
