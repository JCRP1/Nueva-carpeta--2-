#include <Arduino.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WiFi.h>

// WiFi
const char *ssid = "0551";
const char *password = "JEAN2021";

// GreenSense API. Cambia esta IP por la IP LAN de la PC donde corre Next.js.
const char *apiUrl = "http://192.168.1.10:3000/api/iot/readings";
const char *iotApiKey = "greensense-iot-key-change-me";

// Debe coincidir con el dispositivo y sensor registrados en GreenSense.
const char *codigoDispositivo = "ESP32-INV-A-01";
const char *tipoSensor = "humedad_suelo";
const char *unidadSensor = "%";

// Sensor
const int soilMoisturePin = 34;
WebServer server(80);

// Calibracion real ajustada a tu sensor.
int valorSeco = 100;
int valorHumedo = 20;

const unsigned long lecturaIntervaloMs = 2000;
const unsigned long envioIntervaloMs = 15000;

unsigned long ultimaLecturaMs = 0;
unsigned long ultimoEnvioMs = 0;
int ultimaHumedad = 0;

String statusJson() {
  String body = "{";
  body += "\"ok\":true,";
  body += "\"device\":\"esp32\",";
  body += "\"system\":\"greensense\",";
  body += "\"codigoDispositivo\":\"" + String(codigoDispositivo) + "\",";
  body += "\"ipLocal\":\"" + WiFi.localIP().toString() + "\",";
  body += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"uptimeMs\":" + String(millis()) + ",";
  body += "\"ultimaHumedad\":" + String(ultimaHumedad);
  body += "}";
  return body;
}

void configurarServidorRed() {
  server.on("/", HTTP_GET, []() {
    server.send(200, "application/json", statusJson());
  });

  server.on("/status", HTTP_GET, []() {
    server.send(200, "application/json", statusJson());
  });

  server.on("/health", HTTP_GET, []() {
    server.send(200, "text/plain", "ok greensense esp32");
  });

  server.begin();
  Serial.println("Servidor de estado iniciado en puerto 80.");
}

int leerPromedio() {
  int suma = 0;
  for (int i = 0; i < 10; i++) {
    suma += analogRead(soilMoisturePin);
    delay(10);
  }
  return suma / 10;
}

int calcularHumedad(int sensorValue) {
  if (valorSeco == valorHumedo) {
    return 0;
  }

  long humedad = (long)(sensorValue - valorSeco) * 100L / (valorHumedo - valorSeco);

  if (humedad < 0) return 0;
  if (humedad > 100) return 100;
  return (int)humedad;
}

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  Serial.println("Conectando a WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi conectado");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

bool enviarLectura(int humedad) {
  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  HTTPClient http;
  if (!http.begin(apiUrl)) {
    Serial.println("No se pudo iniciar la conexion HTTP. Revisa apiUrl.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-iot-key", iotApiKey);

  String body = "{";
  body += "\"codigoDispositivo\":\"" + String(codigoDispositivo) + "\",";
  body += "\"ipLocal\":\"" + WiFi.localIP().toString() + "\",";
  body += "\"tipo\":\"" + String(tipoSensor) + "\",";
  body += "\"valor\":" + String(humedad) + ",";
  body += "\"unidad\":\"" + String(unidadSensor) + "\"";
  body += "}";

  Serial.print("Enviando a GreenSense: ");
  Serial.println(body);

  int statusCode = http.POST(body);
  String response = http.getString();

  Serial.print("HTTP ");
  Serial.print(statusCode);
  Serial.print(": ");
  Serial.println(response);

  http.end();
  return statusCode >= 200 && statusCode < 300;
}

void setup() {
  Serial.begin(115200);

  pinMode(soilMoisturePin, INPUT);
  analogSetAttenuation(ADC_11db);

  conectarWiFi();
  configurarServidorRed();
}

void loop() {
  unsigned long ahora = millis();

  server.handleClient();

  if (ahora - ultimaLecturaMs >= lecturaIntervaloMs || ultimaLecturaMs == 0) {
    ultimaLecturaMs = ahora;

    int sensorValue = leerPromedio();
    int humedad = calcularHumedad(sensorValue);
    ultimaHumedad = humedad;

    Serial.print("Valor: ");
    Serial.print(sensorValue);
    Serial.print(" | Humedad: ");
    Serial.print(humedad);
    Serial.println("%");
  }

  if (ahora - ultimoEnvioMs >= envioIntervaloMs || ultimoEnvioMs == 0) {
    ultimoEnvioMs = ahora;
    bool ok = enviarLectura(ultimaHumedad);

    if (ok) {
      Serial.println("Lectura registrada en GreenSense.");
    } else {
      Serial.println("No se pudo registrar la lectura.");
    }
  }

  delay(100);
}
