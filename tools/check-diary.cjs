const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HistoryStore,dayKey}=require('./history-store.cjs'),advice=require('../public/advice.js');
const root=fs.mkdtempSync(path.join(path.resolve(__dirname,'..'),'.diary-test-'));
try{
 const first=Date.now()-3*86400000;fs.writeFileSync(path.join(root,'history.json'),JSON.stringify([{at:first,temperature:18,humidity:61}]));
 let store=new HistoryStore(root);assert.equal(store.range(first-1,Date.now()).length,1,'Old data retained beyond 24 hours');
 const rows=[{at:first+30000,temperature:18.2,humidity:60,id:'generation:1',origin:'esp32'},{at:first+60000,temperature:18.4,humidity:59,id:'generation:2',origin:'esp32'}];
 assert.equal(store.import(rows),2);assert.equal(store.import(rows),0,'Import is idempotent');
 assert.equal(store.import([{at:null,temperature:20,humidity:50,id:'untimed'}]),0,'Untimed records must not receive invented dates');
 store=new HistoryStore(root);assert.equal(store.range(first-1,Date.now()).length,3,'Restart retains archived rows without duplication');
 assert.equal(store.range(first+30000,first+60000).length,2);assert(store.days().includes(dayKey(first)));
 assert.equal(dayKey(Date.parse('2026-10-25T23:30:00Z')),'2026-10-26','Local date after DST change');
 assert.equal(dayKey(Date.parse('2026-03-28T23:30:00Z')),'2026-03-29','Local date before DST change');
 store.import([{at:first+90000,temperature:19,humidity:57,id:'generation:3'}]);
 const day=dayKey(first);fs.writeFileSync(path.join(root,'diary',day+'.json'),'broken');assert(store.read(day).length>=3,'Corrupt primary recovers from backup');
 assert.match(advice.humidity({temperature:20,humidity:25}).title,/Low humidity/);
 assert.match(advice.humidity({temperature:20,humidity:45}).title,/reference range/);
 assert.match(advice.humidity({temperature:20,humidity:61},{temperature_2m:5,relative_humidity_2m:90}).tips.join(' '),/Outdoor absolute humidity is lower/);
 assert.match(advice.humidity({temperature:20,humidity:61},{temperature_2m:30,relative_humidity_2m:90}).tips.join(' '),/Outdoor absolute humidity is higher/);
 assert.match(advice.humidity(null).title,/No recent reading/);assert.match(advice.temperature({temperature:16}).join(' '),/18 °C/);
 console.log('OK: daily persistence, recovery, idempotent import, range queries, Rome DST dates, invalid timestamps and practical advice.');
}finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(__dirname,'..'));fs.rmSync(root,{recursive:true,force:true});}
