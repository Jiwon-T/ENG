import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('startup: signed-out devices fetch the login screen with the app and show it without waiting for Firebase',()=>{
 const main=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),hint=fs.readFileSync(new URL('../src/lib/authHint.ts',import.meta.url),'utf8');
 assert.match(main,/if \(!parentSlug && lastSignedOut\(\)\) void loadLogin\(\);/);
 assert.match(app,/const Login = lazy\(loadLogin\);/);assert.match(app,/if \(authLoading && !\(assumeSignedOut && !user\)\) \{/);
 assert.match(app,/rememberSignedIn\(Boolean\(firebaseUser\)\);setAssumeSignedOut\(false\);/,'Firebase still decides as soon as it reports');
 assert.match(hint,/catch \{ return false; \}/,'unknown storage: wait as before');assert.doesNotMatch(app,/loading\.\.\./);assert.doesNotMatch(app+main,/icons\/icon-192\.png/,'loading screens use the rosy logo');
});
