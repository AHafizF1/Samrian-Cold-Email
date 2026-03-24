/**
 * Spintax Parser Utility
 *
 * Pure utility functions for parsing spintax syntax and replacing template variables.
 * No database access - all functions are pure and can be used in any context.
 */

/**
 * Validate spintax syntax.
 * Checks for unbalanced braces and other syntax errors.
 *
 * @param text - Text specifying spintax formatting
 * @returns Object indicating validity and any errors
 */
export function validateSpintax(text: string): { valid: boolean; errors: string[] } {
  // Protect template variables from check
  const variableRegex = /\{\{\w+\}\}/g;
  const textWithoutVars = text.replace(variableRegex, "____");

  const errors: string[] = [];
  let braceCount = 0;

  for (let i = 0; i < textWithoutVars.length; i++) {
    const char = textWithoutVars[i];
    if (char === "{") braceCount++;
    if (char === "}") {
      braceCount--;
      if (braceCount < 0) {
        errors.push("Unbalanced braces: closing brace without matching opening brace");
        braceCount = 0; // Prevent cascade
      }
    }
  }

  if (braceCount > 0) {
    errors.push(`Unbalanced braces: unclosed opening brace`);
  }

  // Check for empty options like {|} or {}
  if (/\{\|/.test(textWithoutVars) || /\|\}/.test(textWithoutVars) || /\|\|/.test(textWithoutVars) || /\{\}/.test(textWithoutVars)) {
    errors.push("Empty spintax options found (e.g., {|} or {})");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse spintax text and select options from {option1|option2|option3} patterns.
 *
 * @param text - Text containing spintax patterns
 * @param preview - If true, deterministically select first option (for preview mode)
 * @returns Processed text with one option selected from each pattern
 * @throws Error if braces are unbalanced
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export function parseSpintax(text: string, preview: boolean = false): string {
  // Check valid syntax first
  const validation = validateSpintax(text);
  if (!validation.valid) {
    throw new Error(validation.errors[0]);
  }

  // First, temporarily replace {{variable}} patterns to protect them from spintax processing
  const variablePlaceholders: string[] = [];
  const variableRegex = /\{\{(\w+)\}\}/g;
  const textWithPlaceholders = text.replace(variableRegex, (match) => {
    const placeholder = `__VAR_${variablePlaceholders.length}__`;
    variablePlaceholders.push(match);
    return placeholder;
  });

  // Process nested spintax from innermost to outermost
  let result = textWithPlaceholders;
  let hasSpintax = true;

  while (hasSpintax) {
    // Find innermost spintax pattern (one without nested braces)
    const spintaxRegex = /\{([^{}]+)\}/;
    const match = result.match(spintaxRegex);

    if (!match) {
      hasSpintax = false;
      break;
    }

    const fullMatch = match[0];
    const content = match[1];

    // Split by pipe to get options
    const options = content.split("|");

    // Select option based on mode
    let selectedOption: string;
    if (preview) {
      // Preview mode: always select first option
      selectedOption = options[0];
    } else {
      // Random mode: randomly select one option
      const randomIndex = Math.floor(Math.random() * options.length);
      selectedOption = options[randomIndex];
    }

    // Replace the spintax pattern with selected option
    result = result.replace(fullMatch, selectedOption);
  }

  // Restore variable placeholders
  variablePlaceholders.forEach((variable, index) => {
    const placeholder = `__VAR_${index}__`;
    result = result.replace(placeholder, variable);
  });

  return result;
}

/**
 * Replace template variables {{variableName}} with values from contact data.
 *
 * @param text - Text containing variable patterns
 * @param variables - Key-value pairs of variable names and values
 * @returns Text with variables replaced, missing variables left unchanged
 *
 * Requirements: 10.1, 10.2
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;

  // Find all {{variableName}} patterns
  const variableRegex = /\{\{(\w+)\}\}/g;

  result = result.replace(variableRegex, (match, variableName) => {
    // If variable exists in data, replace it
    if (variableName in variables) {
      return variables[variableName];
    }
    // Otherwise, leave the placeholder unchanged
    return match;
  });

  return result;
}
