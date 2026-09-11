export function readEnv(name: string): string {
  return process.env[name] || '';
}
