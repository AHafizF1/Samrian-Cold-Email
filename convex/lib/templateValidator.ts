import { validateSpintax, parseSpintax, replaceVariables } from "./spintax";

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
  missingVariables: string[];
}

/**
 * Extract all variable names from text.
 *
 * @param text - Text containing variable patterns
 * @returns Array of unique variable names found
 */
export function extractVariables(text: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();

  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Validates an email template and checks variables against a sample contact.
 *
 * @param template - The email template containing subject and body
 * @param sampleContact - A sample contact with customVars to check against
 * @returns Validation result
 */
export function validateTemplate(
  template: EmailTemplate,
  sampleContact: { customVars: Record<string, string> }
): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check spintax in subject
  const subjectSpintaxValidation = validateSpintax(template.subject);
  if (!subjectSpintaxValidation.valid) {
    errors.push(...subjectSpintaxValidation.errors.map((e) => `Subject: ${e}`));
  }

  // Check spintax in body
  const bodySpintaxValidation = validateSpintax(template.body);
  if (!bodySpintaxValidation.valid) {
    errors.push(...bodySpintaxValidation.errors.map((e) => `Body: ${e}`));
  }

  // Extract variables
  const subjectVariables = extractVariables(template.subject);
  const bodyVariables = extractVariables(template.body);
  const allVariables = Array.from(new Set([...subjectVariables, ...bodyVariables]));

  // Find missing variables
  const missingVariables = allVariables.filter(
    (varName) => !(varName in sampleContact.customVars)
  );

  if (missingVariables.length > 0) {
    warnings.push(
      `The following variables are not present in the sample contact: ${missingVariables.join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variables: allVariables,
    missingVariables,
  };
}

/**
 * Preview template result interface
 */
export interface PreviewResult {
  subject: string;
  body: string;
  variables: string[];
  missingVariables: string[];
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
 */
export function previewTemplate(
  template: EmailTemplate,
  sampleContact: { customVars: Record<string, string> }
): PreviewResult {
  const validation = validateTemplate(template, sampleContact);

  if (!validation.valid) {
    throw new Error(`Template validation failed: \n${validation.errors.join("\n")}`);
  }

  // Process spintax first (in preview mode - deterministic)
  const subjectAfterSpintax = parseSpintax(template.subject, true);
  const bodyAfterSpintax = parseSpintax(template.body, true);

  // Then replace variables
  const finalSubject = replaceVariables(subjectAfterSpintax, sampleContact.customVars);
  const finalBody = replaceVariables(bodyAfterSpintax, sampleContact.customVars);

  return {
    subject: finalSubject,
    body: finalBody,
    variables: validation.variables,
    missingVariables: validation.missingVariables,
  };
}
