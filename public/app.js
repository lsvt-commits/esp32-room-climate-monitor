'use strict';
const $=id=>document.getElementById(id);
function text(id,value){if($(id).textContent!==value)$(id).textContent=value;}
let postcardBusy=false;
let state={connected:false,packet:null,settings:{city:{name:'Torino'}},weather:null},history=[],metric='temperature';
let followLive=true,historyRequest=0,chartRows=[],chartGeometry=null,selectedSample=-1,availableDays=[];
const localDay=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
$('history-day').value=localDay(new Date());$('history-hour').value='00:00';
function period(){const hours=Number($('window').value);if(followLive){const to=Date.now();return {from:to-hours*3600000,to};}const from=new Date($('history-day').value+'T'+($('history-hour').value||'00:00')+':00').getTime();const end=new Date(from);if(hours===24)end.setDate(end.getDate()+1);else end.setHours(end.getHours()+hours);return {from,to:end.getTime()};}
const fmt=(value,digits=1)=>Number.isFinite(value)?value.toLocaleString('it-IT',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
function valid(p){return p?.valid===true&&p.protocol===2&&p.type==='climate'&&Number.isFinite(p.temperature)&&Number.isFinite(p.humidity);}
function fresh(){return state.connected&&valid(state.packet)&&Date.now()-state.packet.receivedAt<10000;}
function absolute(t,h){return 216.7*(h/100*6.112*Math.exp(17.67*t/(t+243.5)))/(273.15+t);}
function weatherText(code){if(code===0)return 'Cielo sereno';if(code<=3)return 'Cielo parzialmente nuvoloso';if([45,48].includes(code))return 'Nebbia';if(code>=51&&code<=57)return 'Pioviggine';if(code>=61&&code<=67)return 'Pioggia';if(code>=71&&code<=77)return 'Neve';if(code>=80&&code<=82)return 'Rovesci';if(code>=85&&code<=86)return 'Rovesci di neve';if(code>=95)return 'Temporale';return 'Meteo attuale';}
function render(){
 const live=fresh(),p=state.packet,w=state.weather,c=w?.current;
 text('connection',live?'● Sensore in diretta':state.connected?'● Lettura non disponibile':'● In attesa del sensore');$('connection').classList.toggle('live',live);
 $('temperature').textContent=live?fmt(p.temperature):'—';$('humidity').textContent=live?fmt(p.humidity,0):'—';
 $('read-time').textContent=live?new Date(p.receivedAt).toLocaleTimeString('it-IT'):'IN ATTESA';
 $('humidity-label').textContent=live?(p.humidity<30?'ARIA SECCA':p.humidity<=50?'NELLA FASCIA DI RIFERIMENTO':p.humidity<60?'SOPRA LA FASCIA DI RIFERIMENTO':'ARIA UMIDA'):'NESSUNA LETTURA';
 $('humidity-marker').hidden=!live;if(live)$('humidity-marker').style.left=p.humidity+'%';
 text('device-message',live?(p.transport==='wifi'?'Wi-Fi attivo · alimentazione USB indipendente.':'USB attiva · una lettura ogni 2,5 secondi.'):p&&!p.valid?p.error:state.message||'Collega l’ESP32 via USB. Le letture appariranno automaticamente.');
 $('city').textContent=state.settings.city.name;$('outside-temperature').textContent=fmt(c?.temperature_2m);
 $('outside-humidity').textContent=Number.isFinite(c?.relative_humidity_2m)?fmt(c.relative_humidity_2m,0)+'%':'—';
 $('wind').textContent=Number.isFinite(c?.wind_speed_10m)?fmt(c.wind_speed_10m,0)+' km/h':'—';
 $('weather-range').textContent=w?.daily?fmt(w.daily.temperature_2m_min?.[0],0)+'° / '+fmt(w.daily.temperature_2m_max?.[0],0)+'°':'—';
 $('weather-description').textContent=c?weatherText(c.weather_code):state.weatherError?'Meteo non disponibile':'Caricamento del meteo…';
 $('weather-error').textContent=state.weatherError||'';
 const note=$('weather-note');note.replaceChildren(document.createTextNode('Stima meteo'+(w?' · aggiornata '+new Date(w.fetchedAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'')+' · '));const link=document.createElement('a');link.href='https://open-meteo.com/';link.target='_blank';link.rel='noreferrer';link.textContent='Open-Meteo';note.append(link);
 const usable=live&&Number.isFinite(c?.temperature_2m)&&Number.isFinite(c?.relative_humidity_2m);
 $('difference').textContent=usable?(p.temperature-c.temperature_2m>0?'+':'')+fmt(p.temperature-c.temperature_2m):'—';
 if(usable){const difference=absolute(p.temperature,p.humidity)-absolute(c.temperature_2m,c.relative_humidity_2m);
 $('comparison-title').textContent=Math.abs(difference)<1?'Aria simile, dentro e fuori.':difference>0?'Fuori c’è meno vapore acqueo.':'Fuori c’è più vapore acqueo.';
 $('comparison-text').textContent='Umidità assoluta: '+fmt(absolute(p.temperature,p.humidity))+' g/m³ dentro, '+fmt(absolute(c.temperature_2m,c.relative_humidity_2m))+' g/m³ fuori. '+(difference>1?'Arieggiare potrebbe ridurre l’umidità, una volta riportata l’aria alla temperatura della stanza.':'Confronto indicativo tra il tuo sensore e una stima meteo esterna.');
 }else{$('comparison-title').textContent='Due ambienti, una prospettiva.';$('comparison-text').textContent='Il confronto si attiva appena sono disponibili entrambe le letture.';}
 $('postcard').disabled=!live||postcardBusy;
 renderRecorder();if($('humidity-dialog').open||$('temperature-dialog').open)renderAdvice();
}
function chart(){
 const selectedAt=chartRows[selectedSample]?.at;
 const hours=Number($('window').value),{from:start,to:now}=period(),rows=history.filter(r=>r.at>=start&&r.at<=now&&Number.isFinite(r[metric]));
 chartRows=rows;$('history-live').setAttribute('aria-pressed',String(followLive));$('history-next').disabled=now>=Date.now();
 $('history-range').textContent=(followLive?'In diretta · ':'')+new Date(start).toLocaleString('it-IT')+' → '+new Date(now).toLocaleString('it-IT');$('history-export').href='/api/export?from='+start+'&to='+now;
 $('chart-empty').hidden=rows.length>0;
 const svg=$('chart'),width=Math.max(200,Math.round(svg.clientWidth||900)),height=240,left=40,right=width-12,top=18,bottom=190;svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.replaceChildren();
 const element=(name,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
 const values=rows.map(r=>r[metric]),minimum=values.length?Math.min(...values):0,maximum=values.length?Math.max(...values):1;
 const margin=metric==='temperature'?1:3,low=minimum-margin,high=maximum+margin;
 for(let i=0;i<4;i++){const y=top+i*(bottom-top)/3;element('line',{x1:left,y1:y,x2:right,y2:y,stroke:'#c6b79d','stroke-dasharray':'3 5'});if(rows.length)element('text',{x:2,y:y+4,fill:'#6c5b47','font-size':11,'font-family':'monospace'},fmt(high-i*(high-low)/3,metric==='temperature'?1:0));}
 const ticks=width<500?3:5;for(let i=0;i<ticks;i++){const at=start+i*(now-start)/(ticks-1);element('text',{x:left+i*(right-left)/(ticks-1),y:223,fill:'#6c5b47','font-size':11,'text-anchor':i===0?'start':i===ticks-1?'end':'middle','font-family':'monospace'},new Date(at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));}
 const xy=r=>[left+(r.at-start)/(now-start)*(right-left),top+(high-r[metric])/(high-low)*(bottom-top)];chartGeometry={start,end:now,xy,width,left,right,top,bottom};
 // Gaps longer than 90 seconds stay visible; disconnected intervals are not interpolated.
 let segment=[];function draw(){if(segment.length>1)element('polyline',{points:segment.map(r=>xy(r).join(',')).join(' '),fill:'none',stroke:'#ba4b29','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'});else if(segment.length===1){const[x,y]=xy(segment[0]);element('circle',{cx:x,cy:y,r:3,fill:'#ba4b29'});}segment=[];}
 for(const r of rows){if(segment.length&&r.at-segment.at(-1).at>90000)draw();segment.push(r);}draw();
 if(rows.length){const[x,y]=xy(rows.at(-1));element('circle',{cx:x,cy:y,r:4,fill:'#ba4b29'});}
 selectedSample=-1;
 $('sample-prev').disabled=rows.length===0;$('sample-next').disabled=rows.length===0;
 if(selectedAt!==undefined){const index=rows.findIndex(r=>r.at===selectedAt);if(index>=0)inspectSample(index);else $('chart-reading').textContent='Tocca il grafico per leggere una misura.';}else $('chart-reading').textContent='Tocca il grafico per leggere una misura.';
 $('extremes').textContent='MIN '+(rows.length?fmt(minimum):'—')+' / MAX '+(rows.length?fmt(maximum):'—')+(metric==='temperature'?' °C':' %')+' · '+hours+' H'+(rows.length>1?' · VARIAZIONE '+(rows.at(-1)[metric]-rows[0][metric]>=0?'+':'')+fmt(rows.at(-1)[metric]-rows[0][metric])+(metric==='temperature'?' °C':' punti UR'):'');
}
async function loadHistory(){const request=++historyRequest;try{const {from,to}=period();if(!Number.isFinite(from)||!Number.isFinite(to))return;const response=await fetch('/api/history?from='+from+'&to='+to);if(!response.ok)throw Error();const rows=await response.json();if(request!==historyRequest)return;history=rows;chart();const metadata=await(await fetch('/api/days')).json();if(request!==historyRequest)return;availableDays=metadata.days||[];state.recorder=metadata.recorder;$('history-day').min=availableDays[0]||localDay(new Date());$('history-day').max=localDay(new Date());renderRecorder();}catch{if(request===historyRequest){$('chart-empty').hidden=false;$('chart-empty').textContent='Archivio momentaneamente non disponibile.';}}}
const events=new EventSource('/api/events');
events.addEventListener('initial',e=>{state=JSON.parse(e.data);render();loadHistory();});
events.addEventListener('device',e=>{Object.assign(state,JSON.parse(e.data));if(!state.connected)state.packet=null;render();});
events.addEventListener('packet',e=>{state.packet=JSON.parse(e.data);state.connected=true;render();if(followLive&&valid(state.packet)&&(!history.length||state.packet.receivedAt-history.at(-1).at>=30000))loadHistory();});
events.addEventListener('history',()=>loadHistory());
events.addEventListener('recorder',e=>{state.recorder=JSON.parse(e.data);renderRecorder();});
events.addEventListener('weather',e=>{Object.assign(state,JSON.parse(e.data));render();});
events.addEventListener('settings',e=>{state.settings=JSON.parse(e.data);state.weather=null;state.weatherError=null;render();});
events.onerror=()=>{state.connected=false;state.message='Connessione al programma locale interrotta. Riconnessione automatica…';render();};
document.querySelectorAll('[data-metric]').forEach(button=>button.addEventListener('click',()=>{metric=button.dataset.metric;document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',b===button));chart();}));
$('window').addEventListener('change',()=>{selectedSample=-1;loadHistory();});
$('change-city').addEventListener('click',()=>{$('city-dialog').showModal();if(window.matchMedia?.('(pointer: fine)').matches)$('city-search').focus();});
$('close-dialog').addEventListener('click',()=>$('city-dialog').close());
$('city-form').addEventListener('submit',async e=>{e.preventDefault();$('city-results').replaceChildren();$('search-message').textContent='Cerco la città…';
 try{const r=await fetch('/api/locations?q='+encodeURIComponent($('city-search').value.trim()));const results=await r.json();if(!r.ok)throw Error(results.error);$('search-message').textContent=results.length?'Scegli la località:':'Nessuna località trovata.';
 for(const city of results){const button=document.createElement('button');button.type='button';button.textContent=[city.name,city.admin1,city.country].filter(Boolean).join(' · ');button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-SP-Action':'settings'},body:JSON.stringify({city})});const result=await r.json();if(!r.ok)throw Error(result.error);state.settings=result.settings;state.weather=null;render();$('city-dialog').close();}catch(err){$('search-message').textContent=err.message;}finally{button.disabled=false;}};$('city-results').append(button);}
 }catch(err){$('search-message').textContent=err.message||'Ricerca non disponibile.';}});
function clock(){$('clock').textContent=new Date().toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).toUpperCase();render();}
setInterval(clock,1000);setInterval(loadHistory,60000);clock();chart();
$('postcard').addEventListener('click',async()=>{
 if(!fresh()||postcardBusy)return;
 postcardBusy=true;
 const button=$('postcard'),reading={...state.packet};button.disabled=true;button.textContent='Preparo la cartolina…';
 let artworkURL;
 try{
  const svg=StanzaPostcard.makePostcard(reading);
  artworkURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Immagine non disponibile'));image.src=artworkURL;});
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;canvas.getContext('2d').drawImage(image,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('Esportazione non disponibile');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='stanza-'+new Date(reading.receivedAt).toISOString().slice(0,10)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }catch(error){$('device-message').textContent='Cartolina non scaricata: '+error.message;}
 finally{postcardBusy=false;if(artworkURL)URL.revokeObjectURL(artworkURL);button.textContent='Scarica cartolina ↗';button.disabled=!fresh();}
});


$('humidity-help').addEventListener('click',()=>{renderAdvice();$('humidity-dialog').showModal();});
$('close-humidity').addEventListener('click',()=>$('humidity-dialog').close());

function renderRecorder(){
 const r=state.recorder||{};let text;
 if(!r.supported)text='Diario sul PC attivo. Registrazione a PC spento disponibile dopo l’aggiornamento del firmware.';
 else if(!r.ready)text='Registrazione sul dispositivo non attiva: '+(r.error||'memoria non pronta');
 else text='ESP32: un campione ogni 30 s, memoria per circa 7 giorni. '+(r.message||'Registrazione autonoma attiva.')+(r.imported?(r.imported===1?' Recuperato un campione.':' Recuperati '+r.imported+' campioni.'):'')+(r.unplaced?' '+r.unplaced+' campioni senza data certa non vengono inseriti nel grafico.':'')+(r.missing?' '+r.missing+' campioni erano già usciti dalla memoria circolare.':'');
 if($('recorder-status').textContent!==text)$('recorder-status').textContent=text;
}
function renderAdvice(){
 const reading=fresh()?state.packet:null,advice=StanzaAdvice.humidity(reading,state.weather?.current);
 $('humidity-advice-title').textContent=advice.title;$('humidity-advice-value').textContent=reading?'Ora: '+fmt(reading.humidity,0)+'% a '+fmt(reading.temperature)+' °C.':'';
 const list=(id,items)=>{$(id).replaceChildren();for(const text of items){const li=document.createElement('li');li.textContent=text;$(id).append(li);}};
 list('humidity-advice',advice.tips);list('temperature-advice',StanzaAdvice.temperature(reading));$('temperature-advice-value').textContent=reading?'Ora nella stanza: '+fmt(reading.temperature)+' °C.':'Nessuna misura recente.';
}
$('temperature-help').addEventListener('click',()=>{renderAdvice();$('temperature-dialog').showModal();});$('close-temperature').addEventListener('click',()=>$('temperature-dialog').close());
function historical(){if(!$('history-day').value||!$('history-hour').value)return;followLive=false;selectedSample=-1;loadHistory();}
$('history-day').addEventListener('change',historical);$('history-hour').addEventListener('change',historical);
function stepPeriod(direction){const {from}=period(),d=new Date(from),hours=Number($('window').value);if(hours===24)d.setDate(d.getDate()+direction);else d.setHours(d.getHours()+direction*hours);if(d.getTime()>Date.now())return;followLive=false;$('history-day').value=localDay(d);$('history-hour').value=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');selectedSample=-1;loadHistory();}
$('history-prev').addEventListener('click',()=>stepPeriod(-1));$('history-next').addEventListener('click',()=>stepPeriod(1));$('history-live').addEventListener('click',()=>{followLive=true;selectedSample=-1;$('history-day').value=localDay(new Date());loadHistory();});
function inspectSample(index){if(!chartRows.length)return;selectedSample=Math.max(0,Math.min(chartRows.length-1,index));const r=chartRows[selectedSample];const reading=new Date(r.at).toLocaleString('it-IT')+' · '+fmt(r.temperature)+' °C · '+fmt(r.humidity,0)+'% UR';if($('chart-reading').textContent!==reading)$('chart-reading').textContent=reading;$('sample-prev').disabled=selectedSample===0;$('sample-next').disabled=selectedSample===chartRows.length-1;
 for(const n of $('chart').querySelectorAll('.chart-cursor'))n.remove();const [x,y]=chartGeometry.xy(r);for(const [tag,attrs]of [['line',{x1:x,x2:x,y1:chartGeometry.top,y2:chartGeometry.bottom,stroke:'#806e55','stroke-dasharray':'3 3'}],['circle',{cx:x,cy:y,r:5,fill:'#392e25'}]]){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);n.setAttribute('class','chart-cursor');for(const [key,value]of Object.entries(attrs))n.setAttribute(key,value);$('chart').append(n);}}
function pointAt(e){if(!chartRows.length)return;const rect=$('chart').getBoundingClientRect();if(!rect.width)return;const x=(e.clientX-rect.left)/rect.width*chartGeometry.width,target=chartGeometry.start+(x-chartGeometry.left)/(chartGeometry.right-chartGeometry.left)*(chartGeometry.end-chartGeometry.start);let low=0,high=chartRows.length-1;while(low<high){const mid=Math.floor((low+high)/2);if(chartRows[mid].at<target)low=mid+1;else high=mid;}if(low>0&&Math.abs(chartRows[low-1].at-target)<Math.abs(chartRows[low].at-target))low--;if(low!==selectedSample)inspectSample(low);}
$('chart').addEventListener('pointerdown',pointAt);$('chart').addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons===1)pointAt(e);});
$('sample-prev').addEventListener('click',()=>inspectSample(selectedSample<0?chartRows.length-1:selectedSample-1));$('sample-next').addEventListener('click',()=>inspectSample(selectedSample<0?0:selectedSample+1));
if(typeof ResizeObserver!=='undefined'){let chartWidth=0;new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width&&width!==chartWidth){chartWidth=width;chart();}}).observe($('chart'));}
$('chart').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();inspectSample(selectedSample<0?0:selectedSample+(e.key==='ArrowRight'?1:-1));}});
