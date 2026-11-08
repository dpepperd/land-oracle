// READ-ONLY profile of DOR NAL/SDF CSVs: per column numeric-ness, decimals, max length, header consistency.
// Usage: node scripts/dor/scan-columns.js <nal|sdf> <extracted_dir> <out.json>
const fs=require('fs'),path=require('path'),csv=require('csv-parser');
const [kind,dir,out]=process.argv.slice(2);
const files=[];for(const d of fs.readdirSync(dir))for(const f of fs.readdirSync(path.join(dir,d)))if(/\.csv$/i.test(f))files.push(path.join(dir,d,f));
const cols={};let headers={},rows=0;
const num=/^-?\d+$/,dec=/^-?\d*\.\d+$/;
(async()=>{for(const f of files){
  await new Promise((res,rej)=>fs.createReadStream(f).pipe(csv({mapHeaders:({header})=>header.trim().replace(/^﻿/,'')}))
   .on('headers',h=>{headers[path.basename(f)]=h;})
   .on('data',r=>{rows++;for(const k in r){const v=r[k];const c=cols[k]||(cols[k]={n:0,blank:0,int:0,dec:0,other:0,maxlen:0,neg:0,maxint:0,ex:null});
     if(v===''||v==null){c.blank++;continue}c.n++;if(v.length>c.maxlen)c.maxlen=v.length;
     if(num.test(v)){c.int++;const a=Math.abs(Number(v));if(a>c.maxint)c.maxint=a;if(v[0]==='-')c.neg++}else if(dec.test(v))c.dec++;else{c.other++;if(!c.ex)c.ex=v.slice(0,30)}}})
   .on('end',res).on('error',rej));console.error('ok',path.basename(f),rows);}
 const first=Object.values(headers)[0].join(',');const diff=Object.entries(headers).filter(([,h])=>h.join(',')!==first).map(([f,h])=>({f,n:h.length,missing:Object.values(headers)[0].filter(x=>!h.includes(x)),extra:h.filter(x=>!Object.values(headers)[0].includes(x))}));
 fs.writeFileSync(out,JSON.stringify({rows,order:Object.values(headers)[0],cols,diff,nfiles:files.length}));console.error('DONE',rows,'hdr_diffs',diff.length);})();
