#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.template || !args.data || !args.output) {
    console.error('Usage: inject.js --template <path> --data <path> --output <path> [--lang <zh|en>]');
    process.exit(1);
  }

  const templatePath = resolve(args.template);
  const dataPath = resolve(args.data);
  const outputPath = resolve(args.output);

  // Read template
  let template;
  try {
    template = readFileSync(templatePath, 'utf-8');
  } catch (e) {
    console.error(`Error reading template: ${e.message}`);
    process.exit(1);
  }

  // Read and validate JSON
  let rawJson;
  try {
    rawJson = readFileSync(dataPath, 'utf-8');
  } catch (e) {
    console.error(`Error reading data file: ${e.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(rawJson);
  } catch (e) {
    console.error(`Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  // Validate required top-level keys
  const requiredKeys = ['meta', 'domains', 'documents'];
  const missing = requiredKeys.filter(k => !(k in data));
  if (missing.length > 0) {
    console.error(`Missing required keys: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Serialize and base64 encode
  const jsonStr = JSON.stringify(data);
  const base64 = Buffer.from(jsonStr).toString('base64');

  // Find and replace placeholder
  const placeholder = 'const KNOWLEDGELENS_DATA = "__KNOWLEDGELENS_DATA_PLACEHOLDER__";';
  if (!template.includes(placeholder)) {
    console.error('Placeholder not found in template: const KNOWLEDGELENS_DATA = "__KNOWLEDGELENS_DATA_PLACEHOLDER__";');
    process.exit(1);
  }

  const injection = `const KNOWLEDGELENS_DATA = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob("${base64}"), c => c.charCodeAt(0))));`;
  const output = template.replace(placeholder, injection);

  // Write output
  writeFileSync(outputPath, output, 'utf-8');
  console.log(`Injected ${jsonStr.length} bytes of JSON (${base64.length} base64 chars) into ${outputPath}`);
}

main();
