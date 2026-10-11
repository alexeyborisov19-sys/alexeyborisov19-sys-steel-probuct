import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..');
const forbidden=['lib/cassette-project/budget.ts','lib/metal-cassette-estimate.ts','lib/quote/basket-volume-price.ts'];
function dependencies(file:string) {
 const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const targets:string[]=[];
 const follow = (name:string) => {
  assert.notEqual(name,'server-only',`${file} is reachable by a client entry`);
  if(!name.startsWith('.')&&!name.startsWith('@/'))return;
  const path=name.startsWith('@/')?resolve(root,name.slice(2)):resolve(dirname(file),name);
  const target=[path,path+'.ts',path+'.tsx',path+'.mjs',path+'/index.ts',path+'/index.tsx'].find(p=>existsSync(p)&&/\.(ts|tsx|mjs)$/.test(p));
  if(target)targets.push(target);
 };
 const visit = (node:ts.Node) => {
  if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)) {
   const clause=node.importClause;
   const onlyTypes=clause?.isTypeOnly || (clause?.namedBindings&&ts.isNamedImports(clause.namedBindings)&&!clause.name&&clause.namedBindings.elements.every(item=>item.isTypeOnly));
   if(!onlyTypes)follow(node.moduleSpecifier.text);
  } else if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)) {
   const onlyTypes=node.isTypeOnly || (node.exportClause&&ts.isNamedExports(node.exportClause)&&node.exportClause.elements.every(item=>item.isTypeOnly));
   if(!onlyTypes)follow(node.moduleSpecifier.text);
  } else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))) {
   const argument=node.arguments[0];
   if(argument&&ts.isStringLiteral(argument))follow(argument.text);
  }
  ts.forEachChild(node,visit);
 };
 visit(source);
 return targets;
}
test('public calculator import graphs never include pricing formula modules',()=>{
 const queue=['components/MetalCassetteCalculator.tsx','components/CassetteBimConfigurator.tsx','components/TrimBimConfigurator.tsx','components/commercial/BasketConfigurator.tsx','lib/cassette-project/export.ts'].map(p=>resolve(root,p));
 const seen=new Set<string>();
 while(queue.length){const file=queue.pop()!;if(seen.has(file))continue;seen.add(file);assert.ok(!forbidden.some(p=>file===resolve(root,p)),`Private pricing module reached: ${file}`);queue.push(...dependencies(file));}
 assert.ok(seen.size>30);assert.match(readFileSync(resolve(root,'lib/cassette-project/budget.ts'),'utf8'),/import ['"]server-only['"]/);
});
