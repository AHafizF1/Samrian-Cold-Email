/**
 * Spintax Parser Utility
 *
 * Pure utility functions for parsing spintax syntax and replacing template variables.
 * No database access - all functions are pure and can be used in any context.
 */

/**
 * Interface for email templates
 */
export interface EmailTemplate {
  subject: string;
  body: string;
}

/**
 * Interface for preview results
 */
export interface PreviewResult {
  subject: string;
  body: string;
  variables: string[];
  missingVariables: string[];
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
  // First, temporarily replace {{variable}} patterns to protect them from spintax processing
  const variablePlaceholders: string[] = [];
  const variableRegex = /\{\{(\w+)\}\}/g;
  const textWithPlaceholders = text.replace(variableRegex, (match) => {
    const placeholder = `__VAR_${variablePlaceholders.length}__`;
    variablePlaceholders.push(match);
    return placeholder;
  });

  // Check for unbalanced braces (after protecting variables)
  let braceCount = 0;
  for (const char of textWithPlaceholders) {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (braceCount < 0) {
      throw new Error("Unbalanced braces: closing brace without matching opening brace");
    }
  }
  if (braceCount !== 0) {
    throw new Error("Unbalanced braces: unclosed opening brace");
  }

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

/**
 * Extract all variable names from text.
 *
 * @param text - Text containing variable patterns
 * @returns Array of unique variable names found
 */
function extractVariables(text: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();

  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Preview a template with sample contact data.
 *
 * Processes both spintax and variables, returning the final output along with
 * metadata about variables found and missing.
 *
 * @param template - Email template with subject and body
 * @param sampleContact - Contact data with customVars for variable replacement
 * @returns Preview result with processed text and variable metadata
 *
 * Requirements: 10.3, 10.4, 10.5
 */
export function previewTemplate(
  template: EmailTemplate,
  sampleContact: { customVars: Record<string, string> }
): PreviewResult {
  // Extract all variables from both subject and body before processing
  const subjectVariables = extractVariables(template.subject);
  const bodyVariables = extractVariables(template.body);
  const allVariables = Array.from(new Set([...subjectVariables, ...bodyVariables]));

  // Identify missing variables
  const missingVariables = allVariables.filter((varName) => !(varName in sampleContact.customVars));

  // Process spintax first (in preview mode - deterministic)
  const subjectAfterSpintax = parseSpintax(template.subject, true);
  const bodyAfterSpintax = parseSpintax(template.body, true);

  // Then replace variables
  const finalSubject = replaceVariables(subjectAfterSpintax, sampleContact.customVars);
  const finalBody = replaceVariables(bodyAfterSpintax, sampleContact.customVars);

  return {
    subject: finalSubject,
    body: finalBody,
    variables: allVariables,
    missingVariables,
  };
}
