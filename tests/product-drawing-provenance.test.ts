import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productBySlug} from '../data/products';

test('window sill points to the actual public source sheet with the sill and fire-stop drawings',()=>{
 assert.equal(productBySlug['otlivy-dlya-okon'].sourceSheet,'/images/products/catalog-sheets/page-09.png');
 assert.equal(productBySlug['akvilon'].sourceSheet,'/images/products/catalog-sheets/page-07.png');
 assert.equal(productBySlug['otkosy-dlya-okon'].sourceSheet,'/images/products/catalog-sheets/page-07.png');
});
