// eslint-disable-next-line functional/no-return-void
export function rejectUnexpectedValue(label: string, value: never) {
  // eslint-disable-next-line functional/no-throw-statement
  throw new Error(`Unexpected value for ${label}: ${String(value)}`);
}
