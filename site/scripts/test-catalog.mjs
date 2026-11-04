import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog, parseRoute} from '../src/catalog.js';

test('catalog retains physical order, normalizes artwork, and resolves folded positions', () => {
  const catalog = createCatalog({records: [
    {id:'second',box:'one',position:2,title:'Second',artist:'Artist',coverPath:'cover.jpg',backCover:'back.jpg'},
    {id:'fold',mergedInto:'alias',box:'one'},
    {id:'alias',mergedInto:'second',box:'one'},
    {id:'first',box:'one',position:1,title:'FIRST',artist:'Other'},
    {id:'book',box:'two',position:1,title:'Book',kind:'book'},
  ]});
  assert.deepEqual(catalog.records.map(r=>r.id),['second','first','book']);
  assert.deepEqual(catalog.forBox('one').map(r=>r.id),['first','second']);
  assert.equal(catalog.find('fold').cover,'cover.jpg');
  assert.equal(catalog.find('fold').back,'back.jpg');
  assert.deepEqual(catalog.foldedPositions('second').map(r=>r.id),['fold','alias']);
  assert.deepEqual(catalog.search(' first ','one').map(r=>r.id),['first']);
  assert.equal(catalog.search('undefined').length,0);
  assert.equal(catalog.find('missing'),undefined);
});

test('broken aliases and cycles terminate without losing source IDs', () => {
  const catalog=createCatalog([{id:'a',mergedInto:'b'},{id:'b',mergedInto:'a'},{id:'orphan',mergedInto:'missing'}]);
  assert.equal(catalog.resolveId('a'),'a');
  assert.equal(catalog.resolveId('orphan'),'orphan');
  assert.equal(catalog.resolveId('unknown'),'unknown');
});

test('routes tolerate malformed encoding independently of catalog loading', () => {
  assert.equal(parseRoute('#record=%'),null);
  assert.deepEqual(parseRoute('#record=some%20id'),{recordId:'some id'});
  assert.deepEqual(parseRoute('#box=right'),{box:'right'});
  assert.equal(parseRoute('#something'),null);
});
