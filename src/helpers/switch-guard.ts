export function rejectUnexpectedValue(label: string, value: never) {
  throw new Error(`Unexpected value for ${label}: ${String(value)}`);
}
