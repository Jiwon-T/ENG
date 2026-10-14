import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import Login,{inAppBrowser,externalOpenUrl} from '../src/components/auth/Login';

test('login: labelled inputs with autofill hints, a password eye, our logo and the official Google mark (no emoji)',()=>{
 const html=renderToStaticMarkup(<Login/>);
 assert.match(html,/<label for="login-email" class="sr-only">이메일<\/label>/);assert.match(html,/autoComplete="username"|autocomplete="username"/i);assert.match(html,/autocomplete="current-password"/i);
 assert.match(html,/aria-label="비밀번호 보기"/);assert.match(html,/src="\/icons\/nib-rose-192.png"/);assert.match(html,/fill="#4285F4"/);assert.match(html,/구글로 시작하기/);
 for(const emoji of ['✒️','🗝️','🏫'])assert.ok(!html.includes(emoji),emoji);
});
test('login: in-app browsers are recognised and sent to a real browser (KakaoTalk opener, Chrome on Android, copy on iPhone)',()=>{
 assert.deepEqual(inAppBrowser('Mozilla/5.0 (Linux; Android 14) KAKAOTALK 10.8.0'),{name:'카카오톡',android:true});
 assert.equal(inAppBrowser('Mozilla/5.0 (iPhone) Instagram 300.0')?.name,'인스타그램');assert.equal(inAppBrowser('Mozilla/5.0 (Windows NT 10.0) Chrome/120'),null);
 assert.equal(externalOpenUrl('https://example.com/a?b=1',{name:'카카오톡',android:false}),'kakaotalk://web/openExternal?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1');
 assert.equal(externalOpenUrl('https://example.com/a?b=1',{name:'인스타그램',android:true}),'intent://example.com/a?b=1#Intent;scheme=https;package=com.android.chrome;end');
 assert.equal(externalOpenUrl('https://example.com/',{name:'인스타그램',android:false}),null,'iPhone: copy the link instead');
});
test('login: busy state, neutral reset message, no developer instructions, only error codes logged',()=>{
 const src=fs.readFileSync(new URL('../src/components/auth/Login.tsx',import.meta.url),'utf8');
 assert.match(src,/disabled=\{busy\} aria-busy=\{busy\}/);assert.match(src,/if \(error\.code === 'auth\/user-not-found'\) setSuccess\(RESET_SENT\);/);
 assert.doesNotMatch(src,/Firebase 콘솔|승인된 도메인/);assert.doesNotMatch(src,/console\.error\([^)]*, error\)/);
 const fb=fs.readFileSync(new URL('../src/lib/firebase.ts',import.meta.url),'utf8');
 assert.doesNotMatch(fb,/helper:', error\)/);assert.doesNotMatch(fb,/message: error\.message,\s*userAgent/);
});
test('login: the old card look (pink tile nib, 지원T English title, rose button) in the rosy palette, not the old hot pink',()=>{
 const src=fs.readFileSync(new URL('../src/components/auth/Login.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(src,/pastel-pink|#5b33f5|#1e1b4b/);assert.match(src,/bg-\[#e0587a\] text-white rounded-2xl/,'rose button');assert.match(src,/rounded-\[28px\][^"]*bg-white/,'white card');assert.match(src,/<NibTile size=\{72\}/,'nib on a light pink tile');const read=(f:string)=>fs.readFileSync(new URL(f,import.meta.url),'utf8');assert.match(read('../src/components/RosyLogo.tsx'),/bg-\[#fdecef\][\s\S]*nib-rose-192\.png/);for(const f of ['../src/main.tsx','../src/App.tsx']){assert.match(read(f),/<NibTile size=\{72\} className="animate-pulse" \/>/,f+': loading screen uses the same tile');assert.doesNotMatch(read(f),/icon-rosy-192/,f);}assert.match(src,/text-\[#e0587a\]">English</);
});
test('login: logo indigo for text, links and background with the app peach button; the short consent line and a three-line notice',()=>{
 const html=renderToStaticMarkup(<Login/>),src=fs.readFileSync(new URL('../src/components/auth/Login.tsx',import.meta.url),'utf8');
 assert.match(html,/로그인하고 오늘 수업을 이어가세요/);assert.match(html,/로그인하면 서비스 이용 안내에 동의한 것으로 봐요/);
 assert.ok(!html.includes('이메일과 이름만'));assert.doesNotMatch(src,/암호화되어/);
 for(const line of ['수집하는 정보','이메일, 이름, 앱 이용 기록(출석·학습)','보는 사람','담당 선생님과 학원 관리자만','문의·삭제','학원에 요청해 주세요'])assert.ok(src.includes(line),line);
 assert.doesNotMatch(src,/#f7f5ff/,'white background');assert.match(src,/min-h-screen flex items-start md:items-center justify-center bg-white/,'white page');
});
test('login: 로그인 | 가입하기 tabs, remembered email (on by default, masked, 다른 계정 forgets), 학부모 note',async()=>{
 const {maskEmail}=await import('../src/components/auth/Login');
 assert.equal(maskEmail('haneul@gmail.com'),'ha•••@gmail.com');
 const html=renderToStaticMarkup(<Login/>),src=fs.readFileSync(new URL('../src/components/auth/Login.tsx',import.meta.url),'utf8');
 assert.match(html,/role="tablist"/);assert.match(html,/aria-selected="true"[^>]*>로그인</);assert.match(html,/>가입하기</);
 assert.match(html,/학부모님은 리포트 링크로 보시면 돼요/);assert.ok(!html.includes('문자로 받은'));assert.doesNotMatch(src,/가입하면 학생 계정으로 시작해요/);
 assert.match(html,/type="checkbox"[^>]*checked=""/,'이메일 기억하기 starts on');assert.match(html,/이메일 기억하기/);
 assert.match(src,/const forget = \(\) => \{ writeStore\(REMEMBER_KEY, null\);/);assert.match(src,/keep\(email\);/);assert.match(src,/keep\(user\?\.email \|\| ''\);/);
});
test('login a11y: unticking 기억하기 saves at once; tabs have roving tabIndex and arrow keys; the notice traps focus, makes the card inert and returns focus',()=>{
 const src=fs.readFileSync(new URL('../src/components/auth/Login.tsx',import.meta.url),'utf8'),html=renderToStaticMarkup(<Login/>);
 assert.match(src,/const changeRemember = \(on: boolean\) => \{ setRemember\(on\); writeStore\(REMEMBER_OFF_KEY, on \? null : '1'\); if \(!on\) \{ writeStore\(REMEMBER_KEY, null\); setSaved\(''\); \} \};/);
 assert.match(src,/onChange=\{e => changeRemember\(e\.target\.checked\)\}/);
 assert.match(html,/role="tab"[^>]*tabindex="0"[^>]*aria-selected="true"/);assert.match(html,/role="tab"[^>]*tabindex="-1"[^>]*aria-selected="false"/);
 assert.match(src,/onKeyDown=\{onTabKey\}/);assert.match(src,/e\.key === 'ArrowRight'/);assert.match(src,/e\.key === 'Home' \? 'login' : e\.key === 'End' \? 'signup'/);
 assert.match(src,/inert=\{showTerms\}/);assert.match(src,/onKeyDown=\{trapTab\}/);assert.match(src,/useEffect\(\(\) => \{ if \(!showTerms\) opener\.current\?\.focus\(\); \}, \[showTerms\]\);/);
});
