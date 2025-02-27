import * as core from '@actions/core'
import {
  filterGitOutputByFile,
  getBranchPoint,
  getChangedDirectories,
  getForceMatchChanges,
  gitDiff
} from './find-changes'
import {getContext} from './context'

async function run(): Promise<void> {
  try {
    const context = await getContext()
    const diffBase = await getBranchPoint()
    core.info(`Using branch point of "${diffBase}" to determine changes`)
    core.setOutput('diff_base', diffBase)

    const diffOutput = await gitDiff(diffBase)
    const forceMatchChanges: boolean = await getForceMatchChanges(
      diffOutput,
      context
    )
    const changedDirectories: string[] = await getChangedDirectories(
      diffOutput,
      context
    )
    const directoryNames = await filterGitOutputByFile(
      changedDirectories,
      context
    )

    core.info(`Changed directories: ${directoryNames.join(' ')}`)
    core.setOutput('changed_directories', directoryNames.join(' '))

    if (directoryNames.length === 0 && !forceMatchChanges) {
      core.setOutput('matrix_empty', 'true')
    } else {
      core.setOutput('matrix_empty', 'false')
    }

    const matrix = {directory: [...directoryNames]}
    const matrixJson = JSON.stringify(matrix)
    core.info(`Created matrix: ${matrixJson}`)
    core.setOutput('matrix', matrixJson)
  } catch (error) {
    core.setFailed(`${error}`)
  }
}

run()
