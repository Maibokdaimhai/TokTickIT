export function passwordRules(value: string) {
  return [
    { label: "At least 10 characters", valid: Array.from(value).length >= 10 },
    { label: "An uppercase letter", valid: /[A-Z]/.test(value) },
    { label: "A lowercase letter", valid: /[a-z]/.test(value) },
    { label: "A number", valid: /[0-9]/.test(value) },
    { label: "A symbol", valid: /[^\p{L}\p{N}\s]/u.test(value) },
    { label: "At most 72 UTF-8 bytes", valid: new Blob([value]).size <= 72 },
    { label: "No NUL characters", valid: !value.includes("\0") },
  ];
}
