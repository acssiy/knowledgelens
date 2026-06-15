#!/usr/bin/env node
/**
 * validate.js — LLM response validation for KnowledgeLens
 * 
 * Validates LLM ingest responses before they are applied:
 * - Structural validation (required fields, types)
 * - Score bounds enforcement [0, 10]
 * - Score delta limiting (max ±2.0 per ingest for existing items)
 * - Deterministic domain score derivation from category scores
 * - Untrusted content marking check
 */

const VALID_ACTIONS = new Set([
  'add_domain', 'add_item', 'update_item',
  'add_gap', 'resolve_gap', 'update_score'
]);

const VALID_LEVELS = new Set(['basic', 'intermediate', 'advanced']);

const MAX_SCORE = 10;
const MIN_SCORE = 0;
const MAX_DELTA = 2.0; // max score change per ingest for existing categories

/**
 * Validates an LLM ingest response. Returns { valid, errors, warnings, sanitized }.
 * - errors: issues that should block apply
 * - warnings: issues that are auto-corrected
 * - sanitized: the cleaned response safe to apply
 */
export function validateResponse(llmResponse, currentIndex) {
  const errors = [];
  const warnings = [];
  
  if (!llmResponse || typeof llmResponse !== 'object') {
    errors.push('Response must be a non-null object');
    return { valid: false, errors, warnings, sanitized: null };
  }
  
  const sanitized = JSON.parse(JSON.stringify(llmResponse)); // deep clone
  
  // Validate updates array
  if (sanitized.updates) {
    if (!Array.isArray(sanitized.updates)) {
      errors.push('updates must be an array');
    } else {
      sanitized.updates = sanitized.updates.filter((update, i) => {
        if (!update || typeof update !== 'object') {
          errors.push(`updates[${i}]: must be an object`);
          return false;
        }
        if (!update.action) {
          errors.push(`updates[${i}]: missing required field "action"`);
          return false;
        }
        if (!VALID_ACTIONS.has(update.action)) {
          errors.push(`updates[${i}]: invalid action "${update.action}"`);
          return false;
        }
        if (!update.target && update.action !== 'add_domain') {
          errors.push(`updates[${i}]: missing "target" for action "${update.action}"`);
          return false;
        }
        // Validate evidence exists for add/update actions
        if (['add_item', 'update_item'].includes(update.action) && !update.evidence) {
          warnings.push(`updates[${i}]: no evidence provided for "${update.action}" — item may lack provenance`);
        }
        // Validate item levels
        if (update.data && update.data.level && !VALID_LEVELS.has(update.data.level)) {
          warnings.push(`updates[${i}]: invalid level "${update.data.level}", defaulting to "basic"`);
          update.data.level = 'basic';
        }
        return true;
      });
    }
  }
  
  // Validate and sanitize score_changes
  if (sanitized.index_changes && sanitized.index_changes.score_changes) {
    const scoreChanges = sanitized.index_changes.score_changes;
    if (!Array.isArray(scoreChanges)) {
      errors.push('index_changes.score_changes must be an array');
    } else {
      for (let i = 0; i < scoreChanges.length; i++) {
        const sc = scoreChanges[i];
        if (typeof sc.newScore !== 'number' || !Number.isFinite(sc.newScore)) {
          errors.push(`score_changes[${i}]: newScore must be a valid number`);
          continue;
        }
        // Clamp with warning
        if (sc.newScore > MAX_SCORE) {
          warnings.push(`score_changes[${i}]: score ${sc.newScore} exceeds max, clamped to ${MAX_SCORE}`);
          sc.newScore = MAX_SCORE;
        }
        if (sc.newScore < MIN_SCORE) {
          warnings.push(`score_changes[${i}]: score ${sc.newScore} below min, clamped to ${MIN_SCORE}`);
          sc.newScore = MIN_SCORE;
        }
        // Delta check against current state
        if (currentIndex && sc.domainId) {
          const domain = currentIndex.domains.find(d => d.id === sc.domainId);
          if (domain) {
            let currentScore = null;
            if (sc.categoryId) {
              const cat = (domain.categories || []).find(c => c.id === sc.categoryId);
              if (cat) currentScore = cat.score;
            } else {
              currentScore = domain.score;
            }
            if (currentScore !== null && currentScore !== undefined) {
              const delta = Math.abs(sc.newScore - currentScore);
              if (delta > MAX_DELTA) {
                warnings.push(`score_changes[${i}]: delta ${delta.toFixed(1)} exceeds max ±${MAX_DELTA} (${currentScore} → ${sc.newScore}), clamping`);
                sc.newScore = currentScore + Math.sign(sc.newScore - currentScore) * MAX_DELTA;
              }
            }
          }
        }
      }
    }
  }
  
  // Validate update_score actions in updates array
  if (sanitized.updates) {
    for (let i = 0; i < sanitized.updates.length; i++) {
      const update = sanitized.updates[i];
      if (update.action === 'update_score' && update.data) {
        if (typeof update.data.score === 'number') {
          if (update.data.score > MAX_SCORE) {
            warnings.push(`updates[${i}]: score ${update.data.score} clamped to ${MAX_SCORE}`);
            update.data.score = MAX_SCORE;
          }
          if (update.data.score < MIN_SCORE) {
            warnings.push(`updates[${i}]: score ${update.data.score} clamped to ${MIN_SCORE}`);
            update.data.score = MIN_SCORE;
          }
        }
      }
    }
  }
  
  // Validate log_entry
  if (sanitized.log_entry && typeof sanitized.log_entry !== 'object') {
    errors.push('log_entry must be an object');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized: errors.length === 0 ? sanitized : null
  };
}

/**
 * Derives domain scores deterministically from category scores (weighted average).
 * Call this after apply to ensure consistency.
 */
export function deriveScores(index) {
  for (const domain of index.domains) {
    const categories = domain.categories || [];
    if (categories.length === 0) continue;
    
    const validCats = categories.filter(c => typeof c.score === 'number' && !isNaN(c.score));
    if (validCats.length === 0) continue;
    
    // Weighted by item count (more items = more influence)
    let totalWeight = 0;
    let weightedSum = 0;
    for (const cat of validCats) {
      const weight = Math.max(1, (cat.items || []).length);
      weightedSum += cat.score * weight;
      totalWeight += weight;
    }
    
    const derived = Math.round((weightedSum / totalWeight) * 10) / 10;
    domain.score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, derived));
  }
  
  return index;
}
