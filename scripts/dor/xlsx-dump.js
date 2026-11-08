// Dumps sheets of an .xlsx (extracted dir) to JSON rows. Usage: node xlsx-dump.js <extracted_dir> <out.json>
const fs=require('fs'),path=require('path');
const d=process.argv[2];
const dec=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const ss=[...fs.readFileSync(path.join(d,'xl/sharedStrings.xml'),'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
const wb=fs.readFileSync(path.join(d,'xl/workbook.xml'),'utf8');
const names=[...wb.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(m=>dec(m[1]));
const out={};
names.forEach((n,i)=>{const x=fs.readFileSync(path.join(d,`xl/worksheets/sheet${i+1}.xml`),'utf8');const rows=[];
 for(const r of x.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)){const row=[];
  for(const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const col=c[1].split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1;const t=/t="s"/.test(c[2]);const v=(c[3]||'').match(/<v>([\s\S]*?)<\/v>/);
   row[col]=v?(t?ss[+v[1]]:dec(v[1])):(/<is>/.test(c[3]||'')?dec([...(c[3].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))].map(x=>x[1]).join('')):null);}
  rows.push(row);}
 out[n]=rows;});
fs.writeFileSync(process.argv[3],JSON.stringify(out));console.log(Object.entries(out).map(([k,v])=>k+':'+v.length).join(' | '));
