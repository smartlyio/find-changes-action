import * as core from '@actions/core'
import {getContext} from './context'
import {
  gitDiff,
  getChangedDirectories,
  filterGitOutputByFile
} from './findChanges'

async function run(): Promise<void> {
  try {
    const context = await getContext()
    const diffOutput = await gitDiff()
    const changedDirectories: string[] = getChangedDirectories(
      diffOutput,
      context
    )
    const directoryNames = await filterGitOutputByFile(
      changedDirectories,
      context
    )

    core.info(`Changed directories: ${directoryNames.join(' ')}`)
    core.setOutput('changed_directories', directoryNames.join(' '))

    if (directoryNames.length === 0) {
      core.setOutput('matrix_empty', 'true')
    } else {
      core.setOutput('matrix_empty', 'false')
    }

    const matrix = {directory: [...directoryNames]}
    const matrixJson = JSON.stringify(matrix)
    core.info(`Created matrix: ${matrixJson}`)
    core.setOutput('matrix', matrixJson)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
