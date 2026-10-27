(function(root){
 'use strict';
 const absolute=(t,h)=>216.7*(h/100*6.112*Math.exp(17.67*t/(t+243.5)))/(273.15+t);
 function humidity(p,outside){
  if(!p)return {title:'Aspettiamo una lettura recente',tips:['I consigli personalizzati compaiono quando il sensore torna in diretta.']};
  const h=p.humidity,tips=[];let title;
  if(h<30){title='Aria secca: aggiungi umidità con misura';tips.push('Se la stanza è troppo calda, riduci leggermente il riscaldamento prima di aggiungere umidità.','Se resta sotto il 30%, valuta un umidificatore dedicato: segui le istruzioni e puliscilo regolarmente.','Controlla il sensore durante l’uso e riduci l’umidificazione quando rientri nella fascia 30–50%.');}
  else if(h<=50){title='Nella fascia di riferimento';tips.push('Non occorre aggiungere umidità. Mantieni un ricambio d’aria regolare.','Continua a osservare il diario, soprattutto dopo docce, bucato o cambi del riscaldamento.');}
  else {title=h>=60?'Aria umida: riduci le fonti di vapore':'Un po’ sopra il riferimento: osserva la durata';tips.push('Se stai asciugando vestiti, spostali in un ambiente ventilato o usa un deumidificatore. Non aggiungere acqua sui termosifoni.','Usa l’aspirazione durante docce e cucina; controlla eventuale condensa su vetri e pareti.');
   if(Number.isFinite(outside?.temperature_2m)&&Number.isFinite(outside?.relative_humidity_2m)){
    const difference=absolute(p.temperature,h)-absolute(outside.temperature_2m,outside.relative_humidity_2m);
    tips.push(difference>1?'Il confronto attuale indica meno vapore fuori: prova un ricambio d’aria breve, poi richiudi e controlla l’andamento.':difference< -1?'Al momento fuori c’è più vapore: aprire per asciugare potrebbe aiutare poco. Riduci le fonti interne e valuta un deumidificatore.':'Dentro e fuori c’è una quantità di vapore simile: riduci prima le fonti interne di umidità.');
   }else tips.push('Arieggia per ridurre l’umidità quando l’aria esterna contiene meno vapore; la sola percentuale esterna non basta per confrontarla con quella interna.');
   tips.push('Riscaldare può far scendere la percentuale relativa, ma non elimina da solo l’acqua presente nell’aria. Se l’umidità alta persiste, controlla ventilazione, perdite e superfici fredde.');
  }
  return {title,tips};
 }
 function temperature(p){
  if(!p)return ['Aspetta una lettura recente prima di regolare il riscaldamento in base a questo sensore.'];
  if(p.temperature<18)return ['La stanza è fresca: verifica che il termostato richieda calore e che i termosifoni non siano coperti da tende o mobili.','Come riferimento generale durante il freddo, punta ad almeno 18 °C negli ambienti usati abitualmente, adattando il comfort alle persone presenti.','Guarda il diario nell’ultima ora per capire se l’aria sta iniziando a scaldarsi. Un solo campione non misura la resa del termosifone.'];
  if(p.temperature>24)return ['Se senti troppo caldo, abbassa gradualmente il termostato e osserva come risponde la stanza.','Riduci il sole diretto con tende o schermature; arieggia per raffrescare quando fuori è più fresco.','Non serve aumentare il riscaldamento per correggere una percentuale alta di umidità: intervieni anche sulle fonti di vapore.'];
  return ['Regola il termostato secondo il tuo comfort e osserva l’andamento prima di modificarlo di nuovo.','Per capire l’effetto del riscaldamento, confronta le misure della stessa stanza in un intervallo di un’ora.','Mantieni libero lo spazio attorno ai termosifoni e lascia il sensore lontano dal loro calore diretto.'];
 }
 const api={humidity,temperature};if(typeof module!=='undefined')module.exports=api;else root.StanzaAdvice=api;
})(typeof window==='undefined'?globalThis:window);
