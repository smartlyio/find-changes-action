export function getBasenames(input: string | string[]): string | string[] {
  const getBasename = (dir: string): string => dir.split('/').pop() || dir
  return Array.isArray(input) ? input.map(getBasename) : getBasename(input)
}

export function createMatrixObjects(
  directories: string[]
): {directory: string; basename: string}[] {
  return directories.map(directory => ({
    directory,
    basename: getBasenames(directory) as string
  }))
}
