/* Same vector artwork is used in the browser download and the saved preview. */
(function(root){
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function makePostcard(reading){
 const t=key=>root.ClimateI18n?.t(key)||key;
 const locale=root.ClimateI18n?.locale()||'en-GB';
 if(!Number.isFinite(reading.temperature)||!Number.isFinite(reading.humidity))throw Error(t('Reading unavailable'));
 const temperature=reading.temperature.toLocaleString(locale,{minimumFractionDigits:1,maximumFractionDigits:1}),humidity=Math.round(reading.humidity).toString();
 const instant=new Date(reading.receivedAt);
 const date=instant.toLocaleDateString(locale,{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric'});
 const time=instant.toLocaleTimeString(locale,{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 const segments={0:'abcedf',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd','-':'g'};
 const shape={a:'8,0 54,0 60,6 53,12 9,12 2,6',g:'9,48 53,48 59,54 53,60 9,60 3,54',d:'9,96 53,96 60,102 54,108 8,108 2,102',f:'0,10 6,16 12,21 12,43 6,50 0,44',b:'62,10 62,44 56,50 50,43 50,21 56,16',e:'0,64 6,58 12,65 12,87 6,94 0,100',c:'62,64 62,100 56,94 50,87 50,65 56,58'};
 function digital(value,x,y,scale){let cursor=0,result='';for(const c of value){if(c==='.'){result+='<circle cx="'+(cursor+7)+'" cy="102" r="5" fill="#e7b26b"/>';cursor+=26;continue;}if(c===','){result+='<path d="M'+(cursor+2)+' 95 h10 v11 l-7 8 h-5 l4-9 h-2z" fill="#e7b26b"/>';cursor+=26;continue;}result+='<g transform="translate('+cursor+' 0) skewX(-4)">';for(const[key,points]of Object.entries(shape))result+='<polygon points="'+points+'" fill="'+((segments[c]||'').includes(key)?'#efbf7c':'#e8b975')+'" opacity="'+((segments[c]||'').includes(key)?'1':'.055')+'"/>';result+='</g>';cursor+=79;}return '<g transform="translate('+x+' '+y+') scale('+scale+')">'+result+'</g>';}
 const text=(x,y,value,size,extra='')=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" '+extra+'>'+escape(value)+'</text>';
 let slots='';for(let i=0;i<8;i++)slots+='<rect x="214" y="'+(851+i*15)+'" width="186" height="5" rx="2.5" fill="#8d8270" opacity=".5"/><path d="M218 '+(850+i*15)+'h178" stroke="#fbf1db" opacity=".8"/>';
 let ticks='';for(let i=0;i<23;i++){const a=(-220+i*10)*Math.PI/180;const inner=i%2===0?120:126,outer=137;const x=711,y=914;ticks+='<path d="M'+(x+Math.cos(a)*inner)+' '+(y+Math.sin(a)*inner)+' L'+(x+Math.cos(a)*outer)+' '+(y+Math.sin(a)*outer)+'" stroke="#786b58" stroke-width="'+(i%2===0?3:2)+'" stroke-linecap="round"/>';}
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="Room temperature and relative humidity">'+
 '<defs><linearGradient id="paper" x2=".8" y2="1"><stop stop-color="#ebe3ce"/><stop offset="1" stop-color="#cec3a6"/></linearGradient><linearGradient id="case" x2=".35" y2="1"><stop stop-color="#fff4dc"/><stop offset=".55" stop-color="#e9dcc0"/><stop offset="1" stop-color="#d3c3a4"/></linearGradient><linearGradient id="glass" x2=".8" y2="1"><stop stop-color="#1c2821"/><stop offset=".55" stop-color="#30382a"/><stop offset="1" stop-color="#19231c"/></linearGradient><linearGradient id="knob" x2=".8" y2="1"><stop stop-color="#fff8e5"/><stop offset=".5" stop-color="#e7d9bc"/><stop offset="1" stop-color="#a9987a"/></linearGradient><filter id="shadow" x="-40%" y="-30%" width="180%" height="190%"><feGaussianBlur stdDeviation="24"/></filter><pattern id="grain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r=".65" fill="#605b43" opacity=".08"/><circle cx="7" cy="1" r=".4" fill="#fff" opacity=".2"/></pattern><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1h4" stroke="#050e08" stroke-width="1" opacity=".15"/></pattern></defs>'+
 '<rect width="1080" height="1080" fill="url(#paper)"/><rect width="1080" height="1080" fill="url(#grain)"/>'+
 '<g fill="#675e4b" font-family="Arial, sans-serif"><g transform="translate(0 -170)">'+
 '<rect x="163" y="316" width="792" height="760" rx="65" fill="#514635" opacity=".32" filter="url(#shadow)"/>'+
 '<rect x="136" y="267" width="808" height="801" rx="60" fill="#b4a181"/><rect x="136" y="255" width="808" height="801" rx="60" fill="url(#case)" stroke="#b6a583" stroke-width="2"/>'+
 '<rect x="146" y="266" width="788" height="779" rx="51" fill="none" stroke="#fff9e5" stroke-width="2" opacity=".8"/>'+
 text(203,348,t('ROOM CLIMATE MONITOR'),32,'fill="#3b382d" font-weight="bold" letter-spacing="-2"')+
 '<path d="M205 381h669" stroke="#a84229" stroke-width="9"/><path d="M205 390h669" stroke="#d59346" stroke-width="3"/>'+
 '<rect x="194" y="455" width="691" height="342" rx="24" fill="#b6a589"/><rect x="199" y="455" width="680" height="332" rx="22" fill="#4a4737"/><rect x="211" y="468" width="656" height="306" rx="12" fill="url(#glass)" stroke="#111a13" stroke-width="3"/>'+
 text(242,507,t('INDOOR'),13,'fill="#cca56a" letter-spacing="3"')+
 digital(temperature,246,535,1.45)+'<circle cx="748" cy="590" r="8" fill="none" stroke="#eabc7b" stroke-width="4"/>'+text(765,628,'C',49,'fill="#eabc7b" font-family="Arial, sans-serif"')+
 '<path d="M242 710h590" stroke="#d6aa6b" opacity=".2"/>'+
 text(243,752,t('HUMIDITY'),19,'fill="#cca56a" letter-spacing="2"')+digital(humidity,636,718,.46)+text(755,758,'%',30,'fill="#eabc7b" font-family="Arial, sans-serif"')+
 '<rect x="211" y="468" width="656" height="306" rx="12" fill="url(#scan)"/><path d="M217 477h637v35L217 492z" fill="#ffffff" opacity=".025"/>'+
 slots+text(213,1000,t('TEMPERATURE AND HUMIDITY'),11,'letter-spacing="1.2"')+'<g transform="translate(711 935) scale(.72) translate(-711 -914)">'+ticks+
 '<ellipse cx="717" cy="929" rx="102" ry="101" fill="#807157" opacity=".25"/><circle cx="711" cy="914" r="100" fill="#b1a081"/><circle cx="711" cy="908" r="98" fill="url(#knob)" stroke="#beae8e" stroke-width="2"/><circle cx="711" cy="908" r="82" fill="none" stroke="#f8ebd1" stroke-width="2"/><circle cx="711" cy="908" r="69" fill="none" stroke="#b5a584" opacity=".4"/><rect x="704" y="829" width="9" height="33" rx="3" fill="#a84229"/><path d="M748 837a81 81 0 0 1 40 63" stroke="#fff5df" stroke-width="4" fill="none" opacity=".7"/>'+
 '</g><circle cx="461" cy="913" r="5" fill="#90936a" stroke="#6c7151"/>'+text(444,949,'ON',10,'letter-spacing="1.5"')+
 '<circle cx="188" cy="309" r="7" fill="#c5b595" stroke="#a89a7e"/><path d="M184 309h8" stroke="#86795f"/><circle cx="892" cy="1000" r="7" fill="#c5b595" stroke="#a89a7e"/><path d="M888 1000h8" stroke="#86795f"/>'+
 '</g><path d="M136 938h808" stroke="#8d8167" opacity=".5"/>'+text(136,982,date,29,'fill="#494535" font-weight="bold" letter-spacing="1"')+text(944,982,time,29,'fill="#494535" text-anchor="end" font-weight="bold" letter-spacing="1"')+
 '</g></svg>';
}
if(typeof module!=='undefined'&&module.exports)module.exports={makePostcard};
else root.ClimatePostcard={makePostcard};
})(typeof globalThis!=='undefined'?globalThis:this);
