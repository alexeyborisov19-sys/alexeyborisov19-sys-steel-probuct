/** Synthetic inputs only. Never upload a customer file to CI. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { TrimProject } from '../lib/bim/trim-model';
import { createTrimCsv, createTrimIfc } from '../lib/bim/trim-export';
import { serializeTrimProject } from '../lib/bim/trim-project';
import { getTrimTemplate, trimSourceUrl, TRIM_GEOMETRY_SCOPE } from '../data/trim-bim-catalog';
import { PRODUCT_CALCULATION_NOTICE } from '../lib/product-calculation-notice';
const root=resolve(process.argv[2]||'output/trim-ifc-validation');mkdirSync(root,{recursive:true});
const base:TrimProject={kind:'steelprodukt-trim-bim',schemaVersion:1,id:'synthetic-trim',elementId:'element-1',revision:1,templateId:'fire-stop',dimensionsMm:{A:50,B:100,H:1000,T:1},mark:'CI-TRIM',material:'',finish:''};
const cases:TrimProject[]=[base,
 {...base,id:'synthetic-unnamed',mark:''},
 {...base,id:'synthetic-custom',dimensionsMm:{A:90,B:150,H:500,T:2}},
 {...base,id:'synthetic-resolution',dimensionsMm:{A:.02,B:.02,H:.01,T:.01}},
 {...base,id:'synthetic-quoted',mark:"CI-'quoted'\\",material:'По проекту',finish:'=not a formula'},
];
const fixtures=[];
for(const [index,p] of cases.entries())for(const suffix of ['','-repeat','-revised']){
 const project=suffix==='-revised'?{...p,revision:2,dimensionsMm:{...p.dimensionsMm,H:p.dimensionsMm.H===.01?.02:p.dimensionsMm.H*1.2}}:p;
 const name=`trim-${index}${suffix}`;
 writeFileSync(join(root,`${name}.ifc`),createTrimIfc(project));writeFileSync(join(root,`${name}.csv`),createTrimCsv(project));writeFileSync(join(root,`${name}.json`),serializeTrimProject(project));
 fixtures.push({name,file:`${name}.ifc`,csv:`${name}.csv`,identityGroup:p.id,project,
 expected:{volumeMm3:(project.dimensionsMm.A+project.dimensionsMm.B-project.dimensionsMm.T)*project.dimensionsMm.T*project.dimensionsMm.H,vertices:12,triangles:20,source:trimSourceUrl(project.templateId),template:getTrimTemplate(project.templateId).title}});
}
writeFileSync(join(root,'manifest.json'),JSON.stringify({synthetic:true,schemaVersion:1,ifcopenshellVersion:'0.8.5',notice:PRODUCT_CALCULATION_NOTICE,geometryScope:TRIM_GEOMETRY_SCOPE,fixtures},null,2));
console.log(`Wrote ${fixtures.length} synthetic trim IFC4 fixtures to ${root}`);
