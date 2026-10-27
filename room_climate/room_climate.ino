#include <Arduino.h>
#include <DHT.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "wifi_secrets.h"
#include "climate_logger.h"
constexpr uint8_t SENSOR_PIN=18;
DHT dht(SENSOR_PIN,DHT11);
WebServer server(80);
uint32_t lastRead=0,lastReconnect=0;
bool networkStarted=false,sensorRead=false;
String lastPacket;
void readSensor(uint32_t now){
 float humidity=dht.readHumidity(),temperature=dht.readTemperature();
 bool valid=isfinite(humidity)&&isfinite(temperature)&&humidity>=0&&humidity<=100&&temperature>=-20&&temperature<=80;
 if(valid)ClimateLog::append(temperature,humidity,now);
 char values[160];
 if(valid)snprintf(values,sizeof(values),"\"valid\":true,\"temperature\":%.1f,\"humidity\":%.1f",temperature,humidity);
 else snprintf(values,sizeof(values),"\"valid\":false,\"temperature\":null,\"humidity\":null");
 lastPacket="{\"protocol\":2,\"type\":\"climate\","+String(values)+",\"uptime\":"+String(now)+",\"sampleId\":"+String(now)+",\"sensor\":\"DHT11\",\"pin\":18,\"wifi\":"+(WiFi.status()==WL_CONNECTED?"true":"false")+",\"ip\":\""+(WiFi.status()==WL_CONNECTED?WiFi.localIP().toString():String(""))+"\"";
 if(!valid)lastPacket+=",\"error\":\"Sensor not responding. Check S to D18, + to 3V3 and - to GND.\"";
 lastPacket+=",\"readIntervalMs\":"+String(ClimateLog::SAMPLE_INTERVAL_MS)+",\"logger\":"+ClimateLog::status()+"}";
 Serial.println(lastPacket);
}
void setup(){
 Serial.begin(115200);dht.begin();
 ClimateLog::begin();
 configTime(0,0,"pool.ntp.org","time.google.com");
 WiFi.mode(WIFI_STA);WiFi.setHostname("esp32-stanza");WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
 const char* headers[]={"X-Stanza-Token"};server.collectHeaders(headers,1);
 server.on("/api/history",HTTP_GET,[](){
  if(server.header("X-Stanza-Token")!=DEVICE_TOKEN){server.send(403,"application/json","{}");return;}
  uint32_t after=strtoul(server.arg("after").c_str(),nullptr,10);server.sendHeader("Cache-Control","no-store");server.send(200,"application/json",ClimateLog::history(after));
 });
 server.on("/api/time",HTTP_POST,[](){
  if(server.header("X-Stanza-Token")!=DEVICE_TOKEN){server.send(403,"application/json","{}");return;}
  uint64_t epoch=strtoull(server.arg("plain").c_str(),nullptr,10);
  if(epoch<1767225600ULL||epoch>4102444800ULL){server.send(400,"application/json","{}");return;}
  timeval tv={time_t(epoch),0};settimeofday(&tv,nullptr);ClimateLog::repairTime();server.send(200,"application/json","{\"ok\":true}");
 });
 server.on("/api/logger/init",HTTP_POST,[](){
  if(server.header("X-Stanza-Token")!=DEVICE_TOKEN){server.send(403,"application/json","{}");return;}
  bool ok=ClimateLog::initialize();server.send(ok?200:500,"application/json",ok?"{\"ok\":true}":"{\"ok\":false}");
 });
 server.on("/api/climate",HTTP_GET,[](){
  if(server.header("X-Stanza-Token")!=DEVICE_TOKEN){server.send(403,"application/json","{\"error\":\"Unauthorized\"}");return;}
  if(lastPacket.isEmpty()){server.send(503,"application/json","{\"error\":\"Waiting for the first reading\"}");return;}
  server.sendHeader("Cache-Control","no-store");server.send(200,"application/json",lastPacket);
 });
 server.onNotFound([](){server.send(404,"application/json","{\"error\":\"Not found\"}");});
}
void loop(){
 uint32_t now=millis();
 if(WiFi.status()==WL_CONNECTED){
  if(!networkStarted){server.begin();if(MDNS.begin("esp32-stanza"))MDNS.addService("http","tcp",80);networkStarted=true;}
  server.handleClient();
 }else{
  if(networkStarted){MDNS.end();server.stop();networkStarted=false;}
  if(now-lastReconnect>15000){lastReconnect=now;WiFi.reconnect();}
 }
 if(!sensorRead||now-lastRead>=ClimateLog::SAMPLE_INTERVAL_MS){sensorRead=true;lastRead=now;readSensor(now);}
 delay(1);
}
