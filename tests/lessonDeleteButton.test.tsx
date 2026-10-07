import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LessonDeleteButton from '../src/components/teacher/LessonDeleteButton';
import fs from 'node:fs';

test('editor delete is restricted to saved owned records or administrators',()=>{
 const render=(record:any,viewer:any={uid:'teacher'},busy=false)=>renderToStaticMarkup(<LessonDeleteButton viewer={viewer} record={record} busy={busy} onDelete={()=>{}}/>);
 assert.match(render({ownerUid:'teacher',stage:'published'}),/일지 삭제/);
 assert.match(render({ownerUid:'teacher',stage:'draft'},undefined,true),/disabled/);
 assert.equal(render(null),'');
 assert.equal(render({ownerUid:'other'}),'');
 assert.equal(render({ownerUid:'teacher',archived:true}),'');
 assert.match(render({ownerUid:'other'},{uid:'admin',admin:true}),/일지 삭제/);
});
test('shared single editor places delete after publish and uses confirmed revision-aware archive',()=>{
 const source=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(source,/이 학생 반영<\/button><LessonDeleteButton/);
 assert.match(source,/window\.confirm\(`/);
 assert.match(source,/request\('archive-lesson',\{id:target.id,revision:target.revision\}\)/);
 assert.match(source,/autoVersion.current===version/);
});
