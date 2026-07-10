export type SensitiveDataCategory =
  | "upi"
  | "card"
  | "bank_account"
  | "ifsc"
  | "aadhaar"
  | "pan";

type SensitivePattern = {
  category: SensitiveDataCategory;
  pattern: RegExp;
};

const patterns: SensitivePattern[] = [
  { category: "upi", pattern: /\b[a-z0-9._-]{2,}@(upi|ybl|okaxis|oksbi|okhdfcbank|paytm|ibl|axl|sbi)\b/gi },
  { category: "ifsc", pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  { category: "pan", pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g },
  { category: "aadhaar", pattern: /\b[2-9][0-9]{3}[ -]?[0-9]{4}[ -]?[0-9]{4}\b/g },
  { category: "card", pattern: /\b(?:[0-9][ -]?){13,19}\b/g },
  { category: "bank_account", pattern: /\b(?:account|a\/c|bank account)\s*(?:no\.?|number)?\s*[:#-]?\s*[0-9]{8,18}\b/gi },
];

function reset(pattern: RegExp) {
  pattern.lastIndex = 0;
}

export function detectSensitiveData(value: string): SensitiveDataCategory[] {
  const found = new Set<SensitiveDataCategory>();

  for (const { category, pattern } of patterns) {
    reset(pattern);
    if (pattern.test(value)) {
      found.add(category);
    }
  }

  return [...found];
}

export function redactSensitiveData(value: string): string {
  let redacted = value;

  for (const { category, pattern } of patterns) {
    reset(pattern);
    redacted = redacted.replace(pattern, `[${category.toUpperCase()} REDACTED]`);
  }

  return redacted;
}

export function sensitiveDataNotice(categories: SensitiveDataCategory[]): string {
  return `Sensitive ${categories.join(", ")} content was withheld before AI processing.`;
}
