import * as core from '@actions/core'

export interface Context {
  directoryContaining: string | null
  directoryLevels: number | null
  exclude: RegExp
  forceAllPattern: RegExp | null
}

export async function getContext(): Promise<Context> {
  const directoryContainingRaw = core.getInput('directory_containing')
  const directoryLevelsRaw = core.getInput('directory_levels')
  const exclude: string = core.getInput('exclude')
  const forceAllOnMatch: string = core.getInput('force_all_on_match')

  const directoryLevels: number | null =
    directoryLevelsRaw === '' ? null : parseInt(directoryLevelsRaw)
  const directoryContaining: string | null =
    directoryContainingRaw === '' ? null : directoryContainingRaw

  if (!directoryLevels && !directoryContaining) {
    throw new Error(
      'One of directory_containing or directory_levels is required'
    )
  } else if (directoryLevels && directoryContaining) {
    throw new Error(
      'Only one of directory_containing or directory_levels is allowed'
    )
  }

  const context: Context = {
    directoryContaining,
    directoryLevels,
    exclude: new RegExp(exclude),
    forceAllPattern: forceAllOnMatch !== '' ? new RegExp(forceAllOnMatch) : null
  }
  return context
}
