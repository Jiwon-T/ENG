import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import Home from '../src/components/Home';
const base={onNavigate:()=>{},userUid:'u1',displayName:'정하늘',avatar:'🐰',onOpenMenu:()=>{},onLinked:()=>{}};
test('home: rosy header with the rosy logo, greeting and date; one menu look; no emoji logo',()=>{
 const html=renderToStaticMarkup(<Home {...base} userRole="student" studentLinked/>);
 assert.match(html,/src="\/icons\/icon-rosy-192.png"/);assert.match(html,/정하늘님, 안녕하세요/);assert.match(html,/bg-\[#fde3e6\]/);
 for(const t of ['학습 리포트','단어 세트','문법 세트','시험기간','나만의 펫','오늘'])assert.ok(html.includes(t),t);
 assert.ok(!html.includes('🏫'));assert.ok(!html.includes('학원 연결하고'),'linked: no banner');assert.match(html,/aria-label="메뉴 열기"/);
});
test('home: an unlinked student gets the 학원 연결 banner; a teacher gets 선생님방 in the 오늘 card',()=>{
 assert.match(renderToStaticMarkup(<Home {...base} userRole="student" studentLinked={false}/>),/학원 연결하고 리포트 받기/);
 const teacher=renderToStaticMarkup(<Home {...base} userRole="teacher"/>);
 assert.match(teacher,/선생님방/);assert.match(teacher,/수업 일지 · 일정 · 성적 관리/);assert.ok(!teacher.includes('학원 연결하고'));
});
test('home: the app bar is hidden on home (the header has the menu button); the rosy logo comes from the original image',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/currentView !== 'teacher-room' && currentView !== 'home' && \(/);assert.match(app,/onOpenMenu=\{\(\) => setIsMenuOpen\(true\)\}/);
 assert.ok(fs.existsSync(new URL('../public/icons/icon-rosy-192.png',import.meta.url)));
});

test('home › 오늘: the 원정대 단어 과제 lines (a linked student) open the game here, and open ones count with the 숙제 badge',()=>{
 const home=fs.readFileSync(new URL('../src/components/Home.tsx',import.meta.url),'utf8'),rows=fs.readFileSync(new URL('../src/components/pet/HomeWordTasks.tsx',import.meta.url),'utf8');
 assert.match(home,/studentLinked && userRole === 'student' && <HomeWordTasks rowClass=\{row\} iconClass=\{rowIcon\} arrowClass=\{rowArrow\} onCount=\{setWordTasks\} \/>/);
 assert.match(home,/homework = \(pending \|\| 0\) \+ wordTasks/);assert.match(home,/숙제 \{homework\}/);
 assert.match(rows,/onCount\?\.\(all\.filter\(t => !t\.completedAt\)\.length\)/,'only open ones count');assert.match(rows,/seoulDay\(t\.completedAt\) === seoulDay\(Date\.now\(\)\)/,'finished today: a ✅ line until the next day');
 assert.match(rows,/PetService\.act\('word-task-words'/,'📝 opens the range test');
 assert.match(rows,/PetService\.act\('feed-start', \{ task: task\.id, quiet/,'straight into the game (no map), asked about a quiet place first');
});
