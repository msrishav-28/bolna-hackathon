export function safeNext(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes(String.fromCharCode(92)) &&
    !value.includes(String.fromCharCode(10)) &&
    !value.includes(String.fromCharCode(13))
    ? value
    : "/";
}
