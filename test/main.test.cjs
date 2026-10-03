const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/main-discord.cjs'), 'utf8');
const success = { retcode: 0, message: 'OK', data: {} };

async function execute({ result = success, status = 200, notify = false, webhookStatus = 204, networkError, webhookGate } = {}) {
  const calls = [];
  const output = [];
  const exits = [];
  const files = {
    token: 'test-token', accountName: 'test-account',
    genshin: 'true', honkai_star_rail: 'false', honkai_3: 'false',
    discord_notify: String(notify), myDiscordID: '',
    discordWebhook: 'https://discord.test/webhook'
  };
  const run = vm.runInNewContext(source, {
    require(name) {
      assert.equal(name, 'fs');
      return { readFileSync(file) { return files[path.basename(file)]; } };
    },
    fetch: async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal, 'requests must have a timeout signal');
      calls.push({ url, options });
      if (url === files.discordWebhook) {
        if (webhookGate) await webhookGate;
        return { ok: webhookStatus < 400, status: webhookStatus, text: async () => '' };
      }
      if (networkError) throw networkError;
      return { ok: status < 400, status, text: async () => typeof result === 'string' ? result : JSON.stringify(result) };
    },
    AbortSignal,
    console: { log: message => output.push(String(message)), error: message => output.push(String(message)) },
    process: { exit: code => exits.push(code) },
    setTimeout: callback => queueMicrotask(callback)
  });
  await run;
  return { calls, output, exits };
}

test('successful check-in completes without an error exit', async () => {
  const r = await execute();
  assert.deepEqual(r.exits, []);
  assert.equal(r.calls.length, 1);
});

test('authentication rejection fails the job and preserves the result message', async () => {
  const r = await execute({ result: { retcode: -100, message: 'Not logged in' } });
  assert.deepEqual(r.exits, [1]);
  assert.ok(r.output.some(line => line.includes('Not logged in')));
});

test('CAPTCHA rejection fails even when the outer retcode is zero', async () => {
  const r = await execute({ result: { retcode: 0, message: 'OK', data: { gt_result: { is_risk: true } } } });
  assert.deepEqual(r.exits, [1]);
});

test('HTTP errors, malformed responses, and timeout errors fail the job', async () => {
  for (const options of [
    { status: 503 }, { result: '<html>failure</html>' },
    { result: { message: 'OK' } }, { result: null },
    { networkError: new DOMException('Request timed out', 'TimeoutError') }
  ]) {
    assert.deepEqual((await execute(options)).exits, [1]);
  }
});

test('network errors do not expose credential-bearing URLs', async () => {
  const r = await execute({ networkError: new TypeError('Invalid URL: https://discord.test/private-token') });
  assert.deepEqual(r.exits, [1]);
  assert.ok(r.output.some(line => line.includes('Network request failed')));
  assert.ok(r.output.every(line => !line.includes('private-token')));
});

test('notification is awaited before the process completes', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let done = false;
  const pending = execute({ notify: true, webhookGate: gate }).then(r => { done = true; return r; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(done, false);
  release();
  assert.deepEqual((await pending).exits, []);
});

test('notification failures have bounded retries and fail the job', async () => {
  const r = await execute({ notify: true, webhookStatus: 500 });
  assert.equal(r.calls.filter(c => c.url === 'https://discord.test/webhook').length, 6);
  assert.deepEqual(r.exits, [1]);
});

test('failed check-ins still produce a notification and then a failed job', async () => {
  const r = await execute({ notify: true, result: { retcode: -100, message: 'Not logged in' } });
  const notification = r.calls.find(c => c.url === 'https://discord.test/webhook');
  assert.ok(JSON.parse(notification.options.body).content.includes('Not logged in'));
  assert.deepEqual(r.exits, [1]);
});
