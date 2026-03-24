/**
 * Manual test script for spintax utility functions
 * Run this with: bunx convex run test/spintaxTest:runTests
 *
 * This test verifies:
 * 1. parseSpintax function (random and preview modes)
 * 2. replaceVariables function
 * 3. previewTemplate function
 * 4. Error handling for unbalanced braces
 */

import { internalAction } from "../_generated/server";
import { parseSpintax, replaceVariables, previewTemplate } from "../lib/spintax";

export const runTests = internalAction({
  args: {},
  handler: async () => {
    const results: string[] = [];
    let passCount = 0;
    let failCount = 0;

    const test = (name: string, fn: () => void) => {
      try {
        fn();
        results.push(`✓ ${name}`);
        passCount++;
      } catch (error) {
        results.push(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
        failCount++;
      }
    };

    results.push("=== Spintax Parser Test Suite ===\n");

    // Test 1: Basic spintax parsing (preview mode)
    test("parseSpintax selects first option in preview mode", () => {
      const input = "{Hi|Hello|Hey} there!";
      const output = parseSpintax(input, true);
      if (output !== "Hi there!") {
        throw new Error(`Expected "Hi there!", got "${output}"`);
      }
    });

    // Test 2: Multiple spintax patterns (preview mode)
    test("parseSpintax handles multiple patterns in preview mode", () => {
      const input = "{Hi|Hello} {friend|buddy}!";
      const output = parseSpintax(input, true);
      if (output !== "Hi friend!") {
        throw new Error(`Expected "Hi friend!", got "${output}"`);
      }
    });

    // Test 3: Nested spintax (preview mode)
    test("parseSpintax handles nested patterns", () => {
      const input = "{Hi {there|friend}|Hello}";
      const output = parseSpintax(input, true);
      if (output !== "Hi there") {
        throw new Error(`Expected "Hi there", got "${output}"`);
      }
    });

    // Test 4: Random mode produces valid output
    test("parseSpintax random mode selects one option", () => {
      const input = "{A|B|C}";
      const output = parseSpintax(input, false);
      if (!["A", "B", "C"].includes(output)) {
        throw new Error(`Expected one of A, B, C, got "${output}"`);
      }
    });

    // Test 5: Unbalanced braces - missing closing brace
    test("parseSpintax throws error for unclosed brace", () => {
      const input = "{Hi|Hello";
      try {
        parseSpintax(input, true);
        throw new Error("Should have thrown error for unbalanced braces");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Unbalanced braces")) {
          throw new Error(`Expected unbalanced braces error, got: ${error}`);
        }
      }
    });

    // Test 6: Unbalanced braces - extra closing brace
    test("parseSpintax throws error for extra closing brace", () => {
      const input = "{Hi|Hello}}";
      try {
        parseSpintax(input, true);
        throw new Error("Should have thrown error for unbalanced braces");
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Unbalanced braces")) {
          throw new Error(`Expected unbalanced braces error, got: ${error}`);
        }
      }
    });

    // Test 7: Variable replacement with existing variables
    test("replaceVariables replaces existing variables", () => {
      const input = "Hi {{firstName}}, welcome to {{company}}!";
      const vars = { firstName: "John", company: "Acme Corp" };
      const output = replaceVariables(input, vars);
      if (output !== "Hi John, welcome to Acme Corp!") {
        throw new Error(`Expected "Hi John, welcome to Acme Corp!", got "${output}"`);
      }
    });

    // Test 8: Variable replacement preserves missing variables
    test("replaceVariables preserves missing variables", () => {
      const input = "Hi {{firstName}}, your code is {{code}}";
      const vars = { firstName: "John" };
      const output = replaceVariables(input, vars);
      if (output !== "Hi John, your code is {{code}}") {
        throw new Error(`Expected "Hi John, your code is {{code}}", got "${output}"`);
      }
    });

    // Test 9: previewTemplate processes both spintax and variables
    test("previewTemplate processes complete template", () => {
      const template = {
        subject: "{Hi|Hello} {{firstName}}",
        body: "Welcome to {{company}}! {We're excited|Looking forward} to work with you.",
      };
      const contact = {
        customVars: { firstName: "John", company: "Acme" },
      };
      const result = previewTemplate(template, contact);

      if (result.subject !== "Hi John") {
        throw new Error(`Expected subject "Hi John", got "${result.subject}"`);
      }
      if (result.body !== "Welcome to Acme! We're excited to work with you.") {
        throw new Error(`Expected specific body, got "${result.body}"`);
      }
    });

    // Test 10: previewTemplate extracts all variables
    test("previewTemplate extracts all variables", () => {
      const template = {
        subject: "Hi {{firstName}}",
        body: "Welcome to {{company}}, {{firstName}}!",
      };
      const contact = { customVars: {} };
      const result = previewTemplate(template, contact);

      const expectedVars = ["firstName", "company"];
      if (
        result.variables.length !== 2 ||
        !result.variables.includes("firstName") ||
        !result.variables.includes("company")
      ) {
        throw new Error(
          `Expected variables [firstName, company], got ${JSON.stringify(result.variables)}`
        );
      }
    });

    // Test 11: previewTemplate identifies missing variables
    test("previewTemplate identifies missing variables", () => {
      const template = {
        subject: "Hi {{firstName}}",
        body: "Welcome to {{company}}!",
      };
      const contact = {
        customVars: { firstName: "John" },
      };
      const result = previewTemplate(template, contact);

      if (result.missingVariables.length !== 1 || result.missingVariables[0] !== "company") {
        throw new Error(
          `Expected missing variables [company], got ${JSON.stringify(result.missingVariables)}`
        );
      }
    });

    // Test 12: Empty template
    test("parseSpintax handles text without spintax", () => {
      const input = "Hello there!";
      const output = parseSpintax(input, true);
      if (output !== "Hello there!") {
        throw new Error(`Expected "Hello there!", got "${output}"`);
      }
    });

    // Test 13: Empty variables
    test("replaceVariables handles text without variables", () => {
      const input = "Hello there!";
      const output = replaceVariables(input, {});
      if (output !== "Hello there!") {
        throw new Error(`Expected "Hello there!", got "${output}"`);
      }
    });

    results.push(`\n=== Test Summary ===`);
    results.push(`Passed: ${passCount}`);
    results.push(`Failed: ${failCount}`);
    results.push(`Total: ${passCount + failCount}`);

    if (failCount === 0) {
      results.push("\n✓ All tests passed!");
    } else {
      results.push(`\n✗ ${failCount} test(s) failed`);
    }

    return results.join("\n");
  },
});
