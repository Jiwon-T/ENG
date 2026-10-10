import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesKoreanSearch,koreanInitials,normalizeSearch,studentSearchResults} from '../src/lib/koreanSearch';
test('initials, partial names, spaces, mixed English and empty queries',()=>{
 assert.equal(koreanInitials('전수현'),'ㅈㅅㅎ');
 for(const [name,query]of [['전수현','ㅈㅅㅎ'],['전수현','수현'],['전 수현',' ㅈ ㅅ ㅎ '],['Alex 김민수','aLEX'],['Alex 김민수','ㄱㅁㅅ'],['학생','']])assert.equal(matchesKoreanSearch(name,query),true);
 assert.equal(matchesKoreanSearch('전수현','ㅈㅅㄴ'),false);
 assert.equal(normalizeSearch(' A B '),'ab');
});
test('today grouping cannot add students outside the supplied authorized list',()=>{
 const permitted=[{studentKey:'a',studentDisplayName:'전수현'},{studentKey:'b',studentDisplayName:'김민수'}];
 assert.deepEqual(studentSearchResults(permitted,'',['b','forbidden']).map(s=>s.studentKey),['b','a']);
 assert.deepEqual(studentSearchResults(permitted,'ㅈㅅㅎ',['forbidden']).map(s=>s.studentKey),['a']);
});
test('keyboard-joined initials and the syllable still being typed',()=>{
 for(const [name,query]of [['김수현','ㄳㅎ'],['류현수','ㅀ'],['전수현','전숳'],['김경현','김겨'],['김경현','김경ㅎ'],['서하늬','하느'],['곽민','고'],['ＡＢ','ab']])assert.equal(matchesKoreanSearch(name,query),true,query);
 for(const [name,query]of [['최준영','줒'],['곽민','가'],['전수현','ㅈㅅㄴ']])assert.equal(matchesKoreanSearch(name,query),false,query);
});
