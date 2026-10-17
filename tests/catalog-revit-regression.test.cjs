const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const req=createRequire(process.env.STEELPRODUKT_TEST_PACKAGE||require('node:path').resolve('package.json'));
const ts=req('typescript'),React=req('react'),ReactDOM=req('react-dom/server');
const source=fs.readFileSync('components/CassetteBimCatalog.tsx','utf8');
const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
const moduleRecord={exports:{}};
const componentRequire=id=>id.endsWith('.module.css')?{default:new Proxy({},{get:(_,key)=>String(key)})}:req(id);
vm.runInNewContext(result.outputText,{exports:moduleRecord.exports,require:componentRequire,module:moduleRecord});
test('closed-lock orientation note appears only on the three closed source models',()=>{
 assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
 const catalog=JSON.parse(fs.readFileSync('public/bim/metallokassety/catalog.json','utf8'));
 const models=catalog.models.map(m=>({id:m.id,name:m.name,bboxMm:m.bbox_mm,thicknessMm:m.measured_thickness_mm,wireframe:''}));
 const html=ReactDOM.renderToStaticMarkup(React.createElement(moduleRecord.exports.CassetteBimCatalog,{models}));
 assert.equal((html.match(/data-model-id=/g)||[]).length,15);
 assert.equal((html.match(/У ЗТ исправлена ориентация/g)||[]).length,3);
 assert.equal((html.match(/IFC4_coordination/g)||[]).length,15);
 assert.equal((html.match(/IFC4_exact_geometry/g)||[]).length,15);
 assert.equal((html.match(/\.rfa/g)||[]).length,0,'no unverified RFA download links');
});
