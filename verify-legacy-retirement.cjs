const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');
const moduleExports = {};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/legacy-routes.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText)(moduleExports);
const { LEGACY_ROUTES, legacyDestination } = moduleExports;
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const oldPages = [...walk('app/dashboard'), ...walk('app/super-admin')].filter(file => file.endsWith('page.tsx'));
for (const file of oldPages) {
  const route = '/' + file.replaceAll('\\', '/').replace(/^app\//, '').replace(/\/page.tsx$/, '');
  assert(LEGACY_ROUTES[route], `Unmapped old route: ${route}`);
}
for (const [oldRoute] of Object.entries(LEGACY_ROUTES)) {
  const destination = legacyDestination(new URL(oldRoute + '?id=test-record&old=1', 'https://example.test'));
  assert(destination && destination.origin === 'https://example.test');
  assert(fs.existsSync(path.join('app', destination.pathname, 'page.tsx')), `Missing destination: ${destination.pathname}`);
  assert(!destination.searchParams.has('old'));
  assert.equal(destination.searchParams.get(oldRoute === '/dashboard/parts/edit' ? 'edit' : 'id'), 'test-record');
}
assert.equal(legacyDestination(new URL('https://example.test/dashboard/add?add=0')).searchParams.get('add'), '1');
assert.equal(legacyDestination(new URL('https://example.test/v3/stock')), null);
const v3Source = walk('app/v3').filter(file => /\.(tsx|ts)$/.test(file)).map(file => fs.readFileSync(file, 'utf8')).join('\n');
assert(v3Source.includes('<ImportExcel'));
assert(v3Source.includes('<LabelPrint30x20'));
for (const symbol of ['exportCSV', 'handleDeleteReceipt', 'deletePayment', 'closeInstallment', 'saveNote', 'handleSave']) {
  assert(v3Source.includes(symbol), `Missing migrated capability: ${symbol}`);
}
console.log(`PASS: ${Object.keys(LEGACY_ROUTES).length} old routes resolve to real v3 pages with record IDs preserved; migrated capabilities exist.`);

function extractFunctions(file, names) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const pieces = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) pieces.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(pieces.length, names.length);
  const output = ts.transpileModule(pieces.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(output + `\nreturn {${names.join(',')}};`)();
}
const { validatePawnRow } = extractFunctions('components/ImportExcel.tsx', ['parseDate', 'validatePawnRow']);
const validPawn = validatePawnRow(['', 'iPhone 12', '', '', 1000, '2026-10-13', 'Customer', '', ''], 0);
assert.equal(validPawn._error, undefined);
assert.equal(validPawn.interest_days, 30);
assert.equal(validPawn.interest_amount, 0);
assert(validatePawnRow(['', 'iPhone 12', '', '', 1000, '2026-10-13', 'Customer', '', '', -1, -5], 0)._error);
const { getDateRange } = extractFunctions('app/v3/reports/detailed/page.tsx', ['getDateRange']);
for (const period of ['7days', '30days', '90days', 'thismonth', 'lastmonth']) {
  const range = getDateRange(period);
  assert.equal((Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1, range.days);
}
console.log('PASS: optional pawn IMEI/default cycle validation and inclusive report date ranges.');
