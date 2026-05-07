import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Extract KNOWLEDGELENS_DATA JSON from an HTML report file.
 * Supports both:
 *   - New base64 style: JSON.parse(atob("..."))
 *   - Old object literal style: brace-counted JSON
 */
export function extractJSON(htmlPath) {
  const html = readFileSync(htmlPath, 'utf-8');
  const marker = 'const KNOWLEDGELENS_DATA = ';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    return { data: null, raw: null, error: 'KNOWLEDGELENS_DATA not found in file' };
  }

  const afterMarker = html.slice(startIdx + marker.length);

  // Try new base64 pattern: JSON.parse(atob("...")) or JSON.parse(new TextDecoder()...atob("..."))
  const atobMatch = afterMarker.match(/atob\("([A-Za-z0-9+/=]+)"\)/);
  if (atobMatch) {
    const base64Str = atobMatch[1];
    try {
      const raw = Buffer.from(base64Str, 'base64').toString('utf-8');
      const data = JSON.parse(raw);
      return { data, raw, error: null };
    } catch (e) {
      return { data: null, raw: null, error: `Base64/JSON parse error: ${e.message}` };
    }
  }

  // Fall back to old brace-counting style
  const jsonStart = startIdx + marker.length;
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  if (end === -1) {
    return { data: null, raw: null, error: 'Could not find end of JSON object (unbalanced braces)' };
  }

  const raw = html.slice(jsonStart, end);
  try {
    const data = JSON.parse(raw);
    return { data, raw, error: null };
  } catch (e) {
    return { data: null, raw, error: `JSON parse error: ${e.message}` };
  }
}

/**
 * Extract and parse JSON directly (for fixture files).
 */
export function loadFixture(jsonPath) {
  const raw = readFileSync(jsonPath, 'utf-8');
  try {
    const data = JSON.parse(raw);
    return { data, raw, error: null };
  } catch (e) {
    return { data: null, raw, error: `JSON parse error: ${e.message}` };
  }
}

/**
 * Check for control characters (literal newlines/tabs) in JSON string values.
 */
export function checkControlChars(raw) {
  const errors = [];
  // Look for unescaped control chars inside JSON string values
  // After parsing succeeded, we check the raw string between quotes
  let inString = false;
  let escape = false;
  let lineNum = 1;
  let col = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    col++;
    if (ch === '\n' && !inString) { lineNum++; col = 0; continue; }
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        const name = code === 0x0a ? '\\n' : code === 0x0d ? '\\r' : code === 0x09 ? '\\t' : `0x${code.toString(16)}`;
        errors.push(`Control character ${name} in string at line ${lineNum}, col ${col}`);
      }
    }
  }
  return errors;
}

/**
 * Validate against the JSON schema (lenient mode).
 * Removes additionalProperties restrictions, relaxes patterns,
 * and makes most fields optional since demos may have evolved from the spec.
 */
export function checkSchema(data, lang = 'zh') {
  const schemaPath = resolve(import.meta.dirname, '..', lang, 'data-schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

  // Make schema lenient for existing content validation
  function relaxSchema(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(relaxSchema);
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'additionalProperties' && v === false) continue;
      if (k === 'enum') continue; // Skip enum restrictions in lenient mode
      if (k === 'pattern' && typeof v === 'string' && v.includes('\\d{4}')) {
        result[k] = '^\\d{4}-\\d{2}-\\d{2}';
        continue;
      }
      // Remove required at nested levels (keep top-level structure check)
      if (k === 'required' && Array.isArray(v)) {
        continue;
      }
      result[k] = relaxSchema(v);
    }
    return result;
  }

  const relaxed = relaxSchema(schema);
  // Restore only top-level required
  relaxed.required = ['meta', 'domains', 'documents'];

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(relaxed);
  const valid = validate(data);
  if (!valid) {
    return validate.errors.map(e => `${e.instancePath} ${e.message}`);
  }
  return [];
}

/**
 * Strict schema validation (for new reports that should match spec exactly).
 */
export function checkSchemaStrict(data, lang = 'zh') {
  const schemaPath = resolve(import.meta.dirname, '..', lang, 'data-schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    return validate.errors.map(e => `${e.instancePath} ${e.message}`);
  }
  return [];
}

/**
 * Check language consistency.
 * For 'en' reports: non-document fields should not contain Chinese characters.
 * Fields checked: expertRoles, level, improvePriority, subtitle, priority
 */
export function checkLanguageConsistency(data, lang) {
  const errors = [];
  const chineseRe = /[\u4e00-\u9fff]/;

  if (lang === 'en') {
    for (const domain of data.domains || []) {
      if (domain.subtitle && chineseRe.test(domain.subtitle)) {
        errors.push(`Domain "${domain.id}" subtitle contains Chinese: "${domain.subtitle}"`);
      }
      for (const role of domain.expertRoles || []) {
        if (chineseRe.test(role)) {
          errors.push(`Domain "${domain.id}" expertRole contains Chinese: "${role}"`);
        }
      }
      for (const cat of domain.categories || []) {
        for (const item of cat.items || []) {
          if (chineseRe.test(item.level)) {
            errors.push(`Item "${item.id}" level contains Chinese: "${item.level}"`);
          }
          if (chineseRe.test(item.improvePriority)) {
            errors.push(`Item "${item.id}" improvePriority contains Chinese: "${item.improvePriority}"`);
          }
        }
      }
      for (const gap of domain.gaps || []) {
        if (gap.priority && chineseRe.test(gap.priority)) {
          errors.push(`Gap "${gap.id}" priority contains Chinese: "${gap.priority}"`);
        }
      }
    }
  }

  if (lang === 'zh') {
    // Basic check: userName should have Chinese
    if (data.meta && data.meta.userName && !chineseRe.test(data.meta.userName)) {
      // Not an error per se, just a note — skip for now
    }
  }

  return errors;
}

/**
 * Check referential integrity:
 * - All docId references resolve to documents
 * - Expert names match domain expertRoles
 * - gap.from[] IDs exist as item IDs
 * Handles both schema-spec and demo-format gap structures.
 */
export function checkReferentialIntegrity(data) {
  const errors = [];
  const documentIds = new Set(Object.keys(data.documents || {}));

  for (const domain of data.domains || []) {
    const expertRoles = new Set(domain.expertRoles || []);
    const allItemIds = new Set();

    for (const cat of domain.categories || []) {
      for (const item of cat.items || []) {
        allItemIds.add(item.id);

        // Check docId exists
        if (item.docId && !documentIds.has(item.docId)) {
          errors.push(`Item "${item.id}" references missing document "${item.docId}"`);
        }

        // Check expert names match expertRoles
        for (const expert of item.experts || []) {
          if (!expertRoles.has(expert.name)) {
            errors.push(`Item "${item.id}" expert "${expert.name}" not in domain expertRoles`);
          }
        }
      }
    }

    // Check gap.from[] references
    for (const gap of domain.gaps || []) {
      if (Array.isArray(gap.from)) {
        for (const fromId of gap.from) {
          if (!allItemIds.has(fromId)) {
            errors.push(`Gap "${gap.id || gap.topic}" references non-existent item "${fromId}" in from[]`);
          }
        }
      }

      // Check gap expert names (if experts exist on gap)
      for (const expert of gap.experts || []) {
        if (!expertRoles.has(expert.name)) {
          errors.push(`Gap "${gap.id || gap.topic}" expert "${expert.name}" not in domain expertRoles`);
        }
      }
    }
  }

  return errors;
}

/**
 * Check value ranges and required non-empty strings.
 */
export function checkValueRanges(data) {
  const errors = [];

  for (const domain of data.domains || []) {
    // Color format
    if (domain.color && !/^#[0-9a-fA-F]{6}$/.test(domain.color)) {
      errors.push(`Domain "${domain.id}" invalid color: "${domain.color}"`);
    }
    // Overall score
    if (domain.overallScore < 0 || domain.overallScore > 10) {
      errors.push(`Domain "${domain.id}" overallScore out of range: ${domain.overallScore}`);
    }
    // Scores
    for (const score of domain.scores || []) {
      if (score.value < 0 || score.value > 10) {
        errors.push(`Domain "${domain.id}" score "${score.label}" value out of range: ${score.value}`);
      }
      const f = score.factors || {};
      for (const key of ['breadth', 'depth', 'application']) {
        if (f[key] !== undefined && (f[key] < 0 || f[key] > 10)) {
          errors.push(`Domain "${domain.id}" score "${score.label}" ${key} out of range: ${f[key]}`);
        }
      }
    }
    // Non-empty required strings
    if (!domain.name) errors.push(`Domain "${domain.id}" has empty name`);
    if (!domain.benchmark) errors.push(`Domain "${domain.id}" has empty benchmark`);
  }

  return errors;
}

/**
 * Check for dangerous content: </script> in string values.
 */
export function checkDangerousContent(data) {
  const errors = [];
  const scriptTag = /<\/script>/i;

  function walkStrings(obj, path = '') {
    if (typeof obj === 'string') {
      if (scriptTag.test(obj)) {
        errors.push(`Dangerous </script> found at ${path}`);
      }
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => walkStrings(v, `${path}[${i}]`));
      return;
    }
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        walkStrings(v, path ? `${path}.${k}` : k);
      }
    }
  }

  walkStrings(data);
  return errors;
}

/**
 * Run all validations on a report HTML file.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateReport(htmlPath, lang = 'zh') {
  const errors = [];

  // Extract JSON
  const { data, raw, error } = extractJSON(htmlPath);
  if (error) {
    return { valid: false, errors: [error] };
  }

  // Control characters
  const ctrlErrors = checkControlChars(raw);
  errors.push(...ctrlErrors);

  // Schema
  const schemaErrors = checkSchema(data, lang);
  errors.push(...schemaErrors);

  // Referential integrity
  const refErrors = checkReferentialIntegrity(data);
  errors.push(...refErrors);

  // Value ranges
  const rangeErrors = checkValueRanges(data);
  errors.push(...rangeErrors);

  // Dangerous content
  const dangerErrors = checkDangerousContent(data);
  errors.push(...dangerErrors);

  return { valid: errors.length === 0, errors };
}

/**
 * Run all validations on raw JSON data (for fixtures).
 */
export function validateData(data, raw, lang = 'zh') {
  const errors = [];

  if (raw) {
    errors.push(...checkControlChars(raw));
  }

  errors.push(...checkSchema(data, lang));
  errors.push(...checkReferentialIntegrity(data));
  errors.push(...checkValueRanges(data));
  errors.push(...checkDangerousContent(data));

  return { valid: errors.length === 0, errors };
}
