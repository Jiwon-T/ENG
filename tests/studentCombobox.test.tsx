import React from 'react';
import test from 'node:test';import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentCombobox from '../src/components/teacher/StudentCombobox';
test('combobox exposes its current authorized student, controlled list id and disabled state',()=>{
 const html=renderToStaticMarkup(<StudentCombobox students={[{studentKey:'a',studentDisplayName:'전수현'}]} value="a" onChange={()=>{}} disabled/>);
 assert.ok(html.includes('role="combobox"'));assert.ok(html.includes('aria-controls='));assert.ok(html.includes('value="전수현"'));assert.ok(html.includes('disabled=""'));assert.ok(!html.includes('<select'));
});
