import * as core from '@actions/core'
import {
  filterGitOutputByFile,
  getBranchPoint,
  getAllDirectories,
  getChangedDirectories,
  getForceMatchChanges,
  gitDiff
} from './find-changes'
import {getContext} from './context'
import {createMatrixObjects} from './utils'

async function run(): Promise<void> {
  try {
    const context = await getContext()
    const diffBase = await getBranchPoint()
    core.info(`Using branch point of "${diffBase}" to determine changes`)
    core.setOutput('diff_base', diffBase)

    const diffOutput = await gitDiff(diffBase)
    const getAllChanges: boolean = await getForceMatchChanges(
      diffOutput,
      context
    )

    const changedDirectories: string[] = getAllChanges
      ? await getAllDirectories(context)
      : await getChangedDirectories(diffOutput, context)

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

    const matrixObjects = createMatrixObjects(directoryNames)
    const multiValueMatrix = JSON.stringify(matrixObjects)
    core.info(`Created multivalue matrix: ${multiValueMatrix}`)
    core.setOutput('multivalue_matrix', multiValueMatrix)
  } catch (error) {
    core.setFailed(`${error}`)
  }
}

run()
