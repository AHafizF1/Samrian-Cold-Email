const REDACTED = "[REDACTED]";

const SECRET_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  /database[_-]?url/i,
  /redis[_-]?url/i,
  /s3[_-]?url/i,
  /smtp/i,
  /imap/i,
  /workos/i,
  /better[_-]?auth/i,
  /better[_-]?stack/i,
];

const SECRET_VALUE_PATTERNS = [
  /^postgres(?:ql)?:\/\//i,
  /^redis:\/\//i,
  /^s3:\/\//i,
  /^Bearer\s+/i,
];

export function redact<T>(value: T): T {
  return redactValue(value, undefined) as T;
}

function redactValue(value: unknown, key: string | undefined): unknown {
  if (key && isSecretKey(key)) return REDACTED;

  if (typeof value === "string") {
    return isSecretString(value) ? REDACTED : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, undefined));
  }

  if (value && typeof value === "object") {
    if (value instanceof Error) {
      return redactError(value);
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ])
    );
  }

  return value;
}

function redactError(error: Error) {
  return {
    name: error.name,
    message: redactValue(error.message, undefined),
    stack: redactValue(error.stack, undefined),
  };
}

function isSecretKey(key: string) {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function isSecretString(value: string) {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}
