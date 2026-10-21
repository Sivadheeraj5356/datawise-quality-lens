const assert = require('node:assert/strict');
const { inspect, parseRows } = require('./app.js');

const rows = parseRows('id,email,revenue\n1,a@example.com,100\n1,bad-email,120\n2,,5000');
assert.equal(rows.length, 3);
const result = inspect(rows);
assert.equal(result.rowCount, 3);
assert.ok(result.findings.some((finding) => finding.issue.includes('Duplicate id')));
assert.ok(result.findings.some((finding) => finding.issue.includes('malformed email')));
assert.ok(result.score < 100);
console.log('3 tests passed');
