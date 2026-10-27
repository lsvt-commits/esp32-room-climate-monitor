'use strict';
const fs=require('node:fs'),path=require('node:path');
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'});
function dayKey(at){const p=Object.fromEntries(dateFormat.formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
function validRow(r){return r&&Number.isFinite(r.at)&&r.at>=1577836800000&&r.at<=Date.now()+300000&&Number.isFinite(r.temperature)&&r.temperature>=-20&&r.temperature<=80&&Number.isFinite(r.humidity)&&r.humidity>=0&&r.humidity<=100;}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value));if(fs.existsSync(file)){try{JSON.parse(fs.readFileSync(file,'utf8'));fs.copyFileSync(file,file+'.bak');}catch(e){if(e.code)throw e;}}fs.renameSync(file+'.tmp',file);}
class HistoryStore{
 constructor(root){this.root=root;this.folder=path.join(root,'diary');fs.mkdirSync(this.folder,{recursive:true});const old=path.join(root,'history.json');if(fs.existsSync(old)){const rows=JSON.parse(fs.readFileSync(old,'utf8').replace(/^\uFEFF/,''));if(!Array.isArray(rows))throw Error('Invalid legacy history');this.import(rows);}}
 read(day){const file=path.join(this.folder,day+'.json');for(const candidate of [file,file+'.bak']){try{const rows=JSON.parse(fs.readFileSync(candidate,'utf8'));if(!Array.isArray(rows))throw Error();return rows.filter(validRow);}catch(e){if(e.code==='ENOENT')continue;if(candidate.endsWith('.bak'))throw Error('Corrupt history file: '+day);}}
 if(fs.existsSync(file))throw Error('Corrupt history file: '+day);return [];}
 days(){return fs.readdirSync(this.folder).filter(n=>/^\d{4}-\d{2}-\d{2}\.json(?:\.bak)?$/.test(n)).map(n=>n.slice(0,10)).filter((n,i,a)=>a.indexOf(n)===i).sort();}
 import(rows){const groups=new Map();for(const r of rows){if(!validRow(r))continue;const day=dayKey(r.at);if(!groups.has(day))groups.set(day,[]);groups.get(day).push({at:r.at,temperature:r.temperature,humidity:r.humidity,...(r.id?{id:String(r.id)}:{}),...(r.origin?{origin:r.origin}:{})});}
 let added=0;for(const [day,incoming]of groups){const old=this.read(day),keys=new Set(old.map(r=>r.id||'legacy:'+r.at));for(const r of incoming){const key=r.id||'legacy:'+r.at;if(keys.has(key))continue;keys.add(key);old.push(r);added++;}if(old.length&&incoming.some(r=>old.includes(r)))atomic(path.join(this.folder,day+'.json'),old.sort((a,b)=>a.at-b.at));}return added;}
 range(from,to){return this.days().filter(d=>d>=dayKey(from)&&d<=dayKey(to)).flatMap(d=>this.read(d)).filter(r=>r.at>=from&&r.at<=to).sort((a,b)=>a.at-b.at);}
}
module.exports={HistoryStore,dayKey,validRow,atomic};
