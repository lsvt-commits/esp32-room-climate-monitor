#pragma once
#include <LittleFS.h>
#include <esp_timer.h>
#include <time.h>
#include <stddef.h>

namespace ClimateLog {
constexpr uint32_t CAPACITY=20160; // Seven days, one sample every 30 seconds.
struct Record {uint32_t sequence,boot,epoch,uptime;int16_t temperature;uint16_t humidity;uint32_t crc;};
static_assert(sizeof(Record)==24,"Unexpected record size");
bool ready=false,repaired=false;uint32_t latest=0,boot=0,lastWrite=0,unplaced=0;String generation,error;
uint32_t checksum(const Record& r){const uint8_t* bytes=reinterpret_cast<const uint8_t*>(&r);uint32_t hash=2166136261U;for(size_t i=0;i<offsetof(Record,crc);++i)hash=(hash^bytes[i])*16777619U;return hash;}
bool valid(const Record& r){return r.sequence&&r.crc==checksum(r)&&r.temperature>=-200&&r.temperature<=800&&r.humidity<=1000;}
uint32_t epoch(){time_t now=time(nullptr);return now>=1767225600?uint32_t(now):0;}
bool read(File& file,uint32_t sequence,Record& r){if(!sequence||!file.seek(((sequence-1)%CAPACITY)*sizeof(r)))return false;return file.read(reinterpret_cast<uint8_t*>(&r),sizeof(r))==sizeof(r)&&valid(r)&&r.sequence==sequence;}
uint32_t oldest(){return latest>CAPACITY?latest-CAPACITY+1:(latest?1:0);}
void begin(){
 boot=esp_random();ready=LittleFS.begin(false);if(!ready){error="Storage requires initialization";return;}
 File file=LittleFS.open("/stanza-log.bin","r");Record r;
 if(file){while(file.read(reinterpret_cast<uint8_t*>(&r),sizeof(r))==sizeof(r))if(valid(r)){if(r.sequence>latest)latest=r.sequence;if(!r.epoch)unplaced++;}file.close();}
 File id=LittleFS.open("/stanza-log-id.txt","r");if(id){generation=id.readString();id.close();}
 if(generation.isEmpty()){generation=String(esp_random(),HEX)+String(esp_random(),HEX);id=LittleFS.open("/stanza-log-id.txt","w");if(!id||id.print(generation)!=generation.length()){ready=false;error="Unable to save the history identifier";}id.close();}
}
bool initialize(){if(ready)return true;if(!LittleFS.format())return false;begin();return ready;}
bool append(float temperature,float humidity,uint32_t now){
 if(!ready||uint32_t(now-lastWrite)<30000)return false;
 Record r={latest+1,boot,epoch(),uint32_t(esp_timer_get_time()/1000000),int16_t(lroundf(temperature*10)),uint16_t(lroundf(humidity*10)),0};r.crc=checksum(r);
 File file=LittleFS.open("/stanza-log.bin",LittleFS.exists("/stanza-log.bin")?"r+":"w+");
 if(!file||!file.seek(((r.sequence-1)%CAPACITY)*sizeof(r))||file.write(reinterpret_cast<const uint8_t*>(&r),sizeof(r))!=sizeof(r)){ready=false;error="Storage write failed";file.close();return false;}
 file.flush();file.close();latest=r.sequence;lastWrite=now;if(!r.epoch)unplaced++;return true;
}
void repairTime(){
 if(!ready||repaired||!epoch())return;
 repaired=true;
 if(!unplaced)return;
 uint32_t offset=epoch()-uint32_t(esp_timer_get_time()/1000000);File file=LittleFS.open("/stanza-log.bin","r+");if(!file)return;
 unplaced=0;Record r;for(uint32_t seq=oldest();seq&&seq<=latest;++seq){if(!read(file,seq,r))continue;if(!r.epoch&&r.boot==boot){r.epoch=offset+r.uptime;r.crc=checksum(r);file.seek(((seq-1)%CAPACITY)*sizeof(r));file.write(reinterpret_cast<const uint8_t*>(&r),sizeof(r));}if(!r.epoch)unplaced++;}file.flush();file.close();
}
String status(){return "{\"supported\":true,\"ready\":"+String(ready?"true":"false")+",\"generation\":\""+generation+"\",\"latest\":"+String(latest)+",\"oldest\":"+String(oldest())+",\"capacity\":"+String(CAPACITY)+",\"intervalSeconds\":30,\"unplaced\":"+String(unplaced)+",\"clockReady\":"+String(epoch()?"true":"false")+",\"error\":\""+error+"\"}";}
String history(uint32_t after){
 repairTime();String response="{\"logger\":"+status()+",\"rows\":[";uint32_t first=max(after+1,oldest()),next=after;int count=0;Record r;File file=LittleFS.open("/stanza-log.bin","r");
 for(uint32_t seq=first;file&&seq&&seq<=latest&&count<128;++seq){next=seq;if(!read(file,seq,r))continue;if(count++)response+=',';response+="{\"id\":\""+generation+":"+String(r.sequence)+"\",\"sequence\":"+String(r.sequence)+",\"at\":"+(r.epoch?String(uint64_t(r.epoch)*1000):String("null"))+",\"temperature\":"+String(r.temperature/10.0f,1)+",\"humidity\":"+String(r.humidity/10.0f,1)+",\"origin\":\"esp32\"}";}
 file.close();return response+"],\"next\":"+String(next)+",\"more\":"+String(next<latest?"true":"false")+"}";
}
}
