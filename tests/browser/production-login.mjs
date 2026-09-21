import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const q=JSON.parse(await readFile('/private/tmp/steel-production-qa.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({userAgent:q.userAgent});
 await page.goto('http://localhost:3100/internal/production-access/login');
 await page.getByLabel('Имя пользователя').fill('qa-login');
 await page.getByLabel('Пароль',{exact:true}).fill(q.password);
 await page.getByRole('button',{name:'Войти',exact:true}).click();
 await page.waitForURL('**/production-access/change-password');
 await page.goto('http://localhost:3100/internal/production-calculator');
 assert.ok(page.url().includes('/change-password'));
 await page.getByLabel('Текущий пароль').fill(q.password);
 await page.getByLabel('Новый пароль',{exact:true}).fill(q.password+'new');
 await page.getByLabel('Повтор нового пароля').fill(q.password+'new');
 await page.getByRole('button',{name:'Изменить пароль'}).click();
 await page.waitForURL('**/internal/production-calculator');
 assert.equal((await page.request.get('http://localhost:3100/internal/personal-data/login')).status(),404);
 assert.equal((await page.request.post('http://localhost:3100/api/internal/production-access/logout',{data:{},headers:{origin:'http://localhost:3100'}})).status(),403);
 await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await page.waitForURL('**/production-access/login');
 await page.goto('http://localhost:3100/internal/production-calculator');
 assert.ok(page.url().includes('/production-access/login'));
 console.log('PASS real login, forced password change, personal-data stays disabled, CSRF rejection, logout');
} finally {await browser.close();}
