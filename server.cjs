const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {validReading,compareAir}=require('./tools/climate-math.cjs');
const {discover}=require('./tools/mdns-discovery.cjs');
const {HistoryStore,atomic}=require('./tools/history-store.cjs');
const ROOT=__dirname;
const bundledPython=process.env.USERPROFILE?path.join(process.env.USERPROFILE,'.platformio/penv/Scripts/python.exe'):null;
const PYTHON=process.env.CLIMATE_PYTHON||process.env.STANZA_PYTHON||(bundledPython&&fs.existsSync(bundledPython)?bundledPython:process.platform==='win32'?'python':'python3');
const storage=path.join(ROOT,'storage');fs.mkdirSync(storage,{recursive:true});
function readSaved(file,fallback){try{return JSON.parse(fs.readFileSync(path.join(storage,file),'utf8').replace(/^\uFEFF/,''));}catch{return fallback;}}
function save(file,value){const target=path.join(storage,file);fs.writeFileSync(target+'.tmp',JSON.stringify(value));fs.renameSync(target+'.tmp',target);}
let settings=readSaved('settings.json',{city:{name:'Torino',latitude:45.0705,longitude:7.6868,country:'Italy'}});
const diary=new HistoryStore(storage);
let syncState=readSaved('sync.json',{}),recorder={supported:false,message:'Verifica registratore…'},syncing=false,lastSync=0;
let device={connected:false,message:'Waiting for ESP32 over USB…'},packet=null,lastReceived=0,lastStored=0,bridge,buffer='',stopping=false;
let weather=null,weatherError=null,weatherPromise=null,weatherKey=null;
let network=readSaved('network.json',null),lastWifi=0,lastDiscovery=0,lastSample=null;
const privateIP=ip=>typeof ip==='string'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)&&ip.split('.').length===4&&ip.split('.').every(n=>/^\d{1,3}$/.test(n)&&Number(n)<=255);
const clients=new Set();
const files={'/':['public/index.html','text/html'],'/i18n.js':['public/i18n.js','text/javascript'],'/app.js':['public/app.js','text/javascript'],'/advice.js':['public/advice.js','text/javascript'],'/postcard.js':['public/postcard.js','text/javascript'],'/style.css':['public/style.css','text/css'],'/room_climate.ino':['room_climate/room_climate.ino','text/plain']};
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function send(res,event,data){res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');}
function broadcast(event,data){for(const client of clients)send(client,event,data);}
function status(){return {...device,recorder,connected:Date.now()-lastReceived<10000,packet,settings,weather,weatherError,comparison:Date.now()-lastReceived<10000?compareAir(packet,weather):null};}
function ingest(data,transport,port){
 if(data?.protocol!==2||data.type!=='climate'||typeof data.valid!=='boolean')return;
 if(network&&privateIP(data.ip)&&network.ip!==data.ip){network.ip=data.ip;save('network.json',network);}
 if(transport==='usb'&&Date.now()-lastWifi<8000)return;
 const sample=data.sampleId??data.uptime;
 if(transport==='wifi'){if(sample===lastSample&&packet?.transport==='wifi')return;lastWifi=Date.now();}
 lastSample=sample;lastReceived=Date.now();packet={...data,receivedAt:lastReceived,transport};device={connected:true,transport,port,message:validReading(packet)?'DHT11 connected over '+(transport==='wifi'?'Wi-Fi':'USB'):packet.error||'Sensor reading failed'};
 if(data.logger)recorder={...recorder,...data.logger};
 if(validReading(packet)&&!data.logger?.supported&&lastReceived-lastStored>=30000){diary.import([{at:lastReceived,temperature:packet.temperature,humidity:packet.humidity,origin:'pc'}]);lastStored=lastReceived;broadcast('history',{updated:true});}
 broadcast('packet',packet);
}
async function pollNetwork(){
 if(stopping||!network)return;
 try{
  if(!privateIP(network.ip)||Date.now()-lastWifi>15000&&Date.now()-lastDiscovery>30000){lastDiscovery=Date.now();const ip=await discover(network.hostname);if(privateIP(ip)&&ip!==network.ip){network.ip=ip;save('network.json',network);}}
  if(privateIP(network.ip)){const r=await fetch('http://'+network.ip+'/api/climate',{headers:{'X-Stanza-Token':network.token},signal:AbortSignal.timeout(2000)});if(r.ok){ingest(await r.json(),'wifi',null);if(packet?.logger?.supported&&Date.now()-lastSync>15000)syncHistory();}}
 }catch{}
 finally{if(!stopping)setTimeout(pollNetwork,2500);}
}
async function syncHistory(){
 if(syncing||!network||!privateIP(network.ip))return;syncing=true;lastSync=Date.now();
 const base='http://'+network.ip,headers={'X-Stanza-Token':network.token};
 try{
  const clock=await fetch(base+'/api/time',{method:'POST',headers,body:String(Math.floor(Date.now()/1000)),signal:AbortSignal.timeout(5000)});if(!clock.ok)throw Error('Clock synchronization failed');
  let cursor=Number.isSafeInteger(syncState.cursor)?syncState.cursor:0,added=0,missing=0;
  for(let page=0;page<160;page++){
   const response=await fetch(base+'/api/history?after='+cursor,{headers,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Device history unavailable');const data=await response.json();
   if(!Array.isArray(data.rows)||!Number.isSafeInteger(data.next)||data.next<0||!data.logger?.generation)throw Error('Invalid device history');
   if(syncState.generation!==data.logger.generation||cursor>data.logger.latest){syncState={generation:data.logger.generation,cursor:0};cursor=0;continue;}
   if(data.logger.oldest>cursor+1)missing+=data.logger.oldest-cursor-1;
   if(data.more&&data.next<=cursor)throw Error('History synchronization made no progress');
   added+=diary.import(data.rows);cursor=data.next;
   syncState={generation:data.logger.generation,cursor};save('sync.json',syncState);
   recorder={...data.logger,syncing:!!data.more,imported:added,missing,message:data.more?'Importing device samples…':'History synchronized',syncedAt:Date.now()};
   broadcast('recorder',recorder);if(added)broadcast('history',{updated:true});
   if(!data.more)break;
  }
 }catch(error){recorder={...recorder,syncing:false,message:error.message};broadcast('recorder',recorder);}
 finally{syncing=false;}
}
function historyRange(url){
 const to=url.searchParams.has('to')?Number(url.searchParams.get('to')):Date.now(),from=url.searchParams.has('from')?Number(url.searchParams.get('from')):to-86400000;
 if(!Number.isFinite(from)||!Number.isFinite(to)||from<1577836800000||to<from||to-from>31*86400000)throw Error('Invalid interval: maximum 31 days');return {from,to};
}
async function fetchJSON(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Weather service unavailable ('+r.status+')');return r.json();}
async function updateWeather(force=false){
 const city=settings.city,key=city.latitude+','+city.longitude;
 if(weatherPromise){await weatherPromise;if(settings.city.latitude+','+settings.city.longitude!==weatherKey)return updateWeather(force);return weather;}
 if(!force&&weather&&weatherKey===key&&Date.now()-weather.fetchedAt<600000)return weather;
 weatherPromise=(async()=>{try{const data=await fetchJSON('https://api.open-meteo.com/v1/forecast?latitude='+city.latitude+'&longitude='+city.longitude+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=1');
 if(settings.city.latitude+','+settings.city.longitude!==key)return null;
 if(!data.current||!Number.isFinite(data.current.temperature_2m))throw Error('Invalid weather data');
 weather={...data,city,fetchedAt:Date.now()};weatherKey=key;weatherError=null;broadcast('weather',{weather,weatherError});return weather;
 }catch(e){weatherError=e.message;broadcast('weather',{weather,weatherError});return null;}finally{weatherPromise=null;}})();
 return weatherPromise;
}
function startBridge(){
 if(stopping)return;
 bridge=spawn(PYTHON,['-u',path.join(ROOT,'tools/serial-bridge.py')],{cwd:ROOT,windowsHide:true});
 bridge.stdout.on('data',chunk=>{buffer+=chunk.toString();let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);try{const value=JSON.parse(line);if(value.kind==='packet'){
 ingest(value.data,'usb',value.port);
 }else if(value.kind==='status'&&Date.now()-lastWifi>=10000){device=value;if(!value.connected){lastReceived=0;packet=null;}if(network)device.message='Waiting for ESP32 over Wi-Fi or USB…';broadcast('device',device);}}catch(e){console.error('Bridge:',e.message);}}
 if(buffer.length>32000)buffer='';});
 bridge.stderr.on('data',data=>console.error(data.toString()));
 bridge.on('error',e=>{device={connected:false,message:'USB connection failed: '+e.message};broadcast('device',device);});
 bridge.on('exit',()=>{buffer='';if(Date.now()-lastWifi>=10000){lastReceived=0;packet=null;device={connected:false,message:'Reconnecting…'};broadcast('device',device);}if(!stopping)setTimeout(startBridge,2000);});
}
const server=http.createServer(async(req,res)=>{
 if(!['localhost:8000','127.0.0.1:8000'].includes(req.headers.host))return json(res,403,{error:'Host not allowed'});
 const url=new URL(req.url,'http://localhost:8000'),route=url.pathname;
 if(req.method==='GET'){
 if(route==='/api/status')return json(res,200,status());
 if(route==='/api/history'){try{const {from,to}=historyRange(url);return json(res,200,diary.range(from,to));}catch(e){return json(res,400,{error:e.message});}}
 if(route==='/api/days')return json(res,200,{days:diary.days(),recorder});
 if(route==='/api/weather'){await updateWeather();return json(res,200,{weather,weatherError,city:settings.city});}
 if(route==='/api/locations'){const q=url.searchParams.get('q')?.trim();if(!q||q.length>80)return json(res,400,{error:'Enter a city name'});try{const data=await fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=5&language=en&format=json');return json(res,200,data.results||[]);}catch(e){return json(res,502,{error:e.message});}}
 if(route==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write('retry: 1500\n\n');clients.add(res);send(res,'initial',status());req.on('close',()=>clients.delete(res));return;}
 if(route==='/api/export'){try{const {from,to}=historyRange(url),rows=diary.range(from,to);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="room-climate-readings.csv"'});return res.end('timestamp_UTC,temperature_C,relative_humidity_percent\n'+rows.map(r=>new Date(r.at).toISOString()+','+r.temperature+','+r.humidity).join('\n'));}catch(e){return json(res,400,{error:e.message});}}
 if(!files[route])return json(res,404,{error:'Not found'});const [file,mime]=files[route];return fs.readFile(path.join(ROOT,file),(error,data)=>{if(error)return json(res,404,{error:'File unavailable'});res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
 }
 if(req.method==='POST'&&route==='/api/settings'){
 if(!['http://localhost:8000','http://127.0.0.1:8000'].includes(req.headers.origin)||req.headers['x-sp-action']!=='settings')return json(res,403,{error:'Request not allowed'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return json(res,413,{error:'Request too large'});}
 try{const {city}=JSON.parse(body);if(typeof city?.name!=='string'||!city.name.trim()||city.name.length>80||!Number.isFinite(city.latitude)||Math.abs(city.latitude)>90||!Number.isFinite(city.longitude)||Math.abs(city.longitude)>180)throw Error('Invalid city');
 settings={city:{name:city.name.trim(),latitude:city.latitude,longitude:city.longitude,country:typeof city.country==='string'?city.country.slice(0,80):''}};save('settings.json',settings);weather=null;weatherKey=null;broadcast('settings',settings);json(res,200,{ok:true,settings});updateWeather(true);return;}catch(e){return json(res,400,{error:e.message});}
 }
 json(res,405,{error:'Method not allowed'});
});
setInterval(()=>{for(const client of clients)client.write(': heartbeat\n\n');if(device.connected&&Date.now()-lastReceived>=10000){device={...device,connected:false,message:'Readings stopped. Check the device connection.'};broadcast('device',device);}},3000);
setInterval(()=>updateWeather(),600000);
server.listen(8000,'127.0.0.1',()=>{console.log('ESP32 Room Climate Monitor — http://localhost:8000');if((process.env.CLIMATE_DISABLE_USB||process.env.STANZA_DISABLE_USB)!=='1')startBridge();pollNetwork();updateWeather();});
function shutdown(){stopping=true;bridge?.kill();server.close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
