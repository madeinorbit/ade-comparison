// Counts unknown filter cells per covered product in the generated data/ package.
// node research/notes/open-source-depth-2026-11/unknowns.mjs [repo-root] [json]
import fs from 'fs';
const root=process.argv[2]||'.';
const defs=JSON.parse(fs.readFileSync(root+'/data/facets.json')).facets;
const rows=[];
for(const f of fs.readdirSync(root+'/data/products')){
  const j=JSON.parse(fs.readFileSync(root+'/data/products/'+f));
  if(!j.facets) continue;
  let unk=0,known=0,cc=0;const unkList=[];
  for(const d of defs){
    if(d.id==='lifecycle-status') continue;
    const c=j.facets[d.id];
    const cells = d.multiple ? d.options.map(o=>[d.id+':'+o.id,c?.[o.id]]) : [[d.id,c]];
    for(const [k,v] of cells){ if(!v||v.value==='unknown'){unk++;unkList.push(k)} else {known++; if(v.verificationStatus==='agent-cross-checked')cc++;} }
  }
  rows.push({id:j.id,repo:j.repository?.url||j.repository||'',lic:j.facets.license?.value,unk,known,cc,unkList});
}
rows.sort((a,b)=>b.unk-a.unk);
if(process.argv[3]==='json') console.log(JSON.stringify(rows,null,1)); else
for(const r of rows) console.log(r.id.padEnd(22),String(r.unk).padStart(3),String(r.known).padStart(3),String(r.cc).padStart(3),(r.lic||'').padEnd(12),JSON.stringify(r.repo));
