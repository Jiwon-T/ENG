import test from 'node:test';
import assert from 'node:assert/strict';
import {WordbookCache} from '../src/lib/wordbookCache.ts';
test('wordbook cache isolates book IDs, expires and bounds memory',()=>{
 const cache=new WordbookCache<string>(2,100);
 cache.put('a',['a'],0);cache.put('b',['b'],1);
 assert.deepEqual(cache.get('a',10),['a']);assert.deepEqual(cache.get('b',10),['b']);
 cache.put('c',['c'],20);assert.equal(cache.get('a',21),undefined);
 assert.deepEqual(cache.get('c',119),['c']);assert.equal(cache.get('c',120),undefined);
});
test('late hover prefetch cannot overwrite a newer live snapshot',()=>{
 const cache=new WordbookCache<string>();cache.put('book',['live'],100);
 cache.put('book',['old-prefetch'],110,90);assert.deepEqual(cache.get('book',120),['live']);
});
