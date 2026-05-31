const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '../../supabase/schema.sql');

function getFunctionBody(functionName) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
    'm',
  );
  const match = schema.match(pattern);
  assert.ok(match, `${functionName} definition should exist in schema.sql`);
  return match[0];
}

test('ai usage schema: increment function avoids ambiguous month_bucket conflict target', () => {
  const functionBody = getFunctionBody('increment_my_ai_monthly_usage');

  assert.match(functionBody, /ON CONFLICT ON CONSTRAINT ai_monthly_usage_pkey/);
  assert.doesNotMatch(
    functionBody,
    /ON CONFLICT\s*\(\s*customer_id\s*,\s*month_bucket\s*,\s*usage_type\s*\)/,
  );
});
