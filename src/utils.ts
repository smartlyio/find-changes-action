export function getBasenames(directories: string[]): string[] {
  return directories.map(dir => dir.split('/').pop() || dir)
}
