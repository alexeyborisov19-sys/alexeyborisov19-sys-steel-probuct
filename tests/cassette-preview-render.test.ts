import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { buildCassetteElevation, createCassetteElevation } from '../lib/cassette-project/model';
const output=buildSync({stdin:{contents:`import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {CassetteElevationPreview} from './components/cassette-project/CassetteElevationPreview';export const render=p=>renderToStaticMarkup(createElement(CassetteElevationPreview,p));`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,logLevel:'silent'});
const compiled={exports:{} as {render:(p:unknown)=>string}};
new Function('module','exports','require',output.outputFiles[0].text)(compiled,compiled.exports,createRequire(`${process.cwd()}/package.json`));
test('real cassette preview exposes nonempty accessible SVG and per-panel titles',()=>{
 const elevation=createCassetteElevation('E1','Южный фасад');
 const layout=buildCassetteElevation(elevation,'project1');
 const html=compiled.exports.render({elevation,layout,selectedId:null,onSelect(){},showMarks:true});
 assert.match(html,/<title[^>]*>Южный фасад: маркированная раскладка металлокассет<\/title>/);
 assert.ok(html.includes(`${layout.panels[0].mark} · Целая`));
 assert.doesNotMatch(html,/<title[^>]*><\/title>|NaN|Infinity/);
});
