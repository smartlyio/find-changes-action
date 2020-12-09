import * as core from '@actions/core'
import {gitDiff, filterGitOutput} from './utils'

async function run(): Promise<void> {
  try {
    const gitOutput = await gitDiff()
    const packageNames = filterGitOutput(gitOutput)
    const changedPackages: string = packageNames.join(' ')
    core.info(`Changed directories: ${changedPackages}`)
    core.setOutput('changed_directories', changedPackages)

    if (packageNames.length === 0) {
      core.setOutput('matrix_empty', 'true')
    } else {
      core.setOutput('matrix_empty', 'false')
    }

    const matrix = {directory: [...packageNames]}
    const matrixJson = JSON.stringify(matrix)
    core.info(`Created matrix: ${matrixJson}`)
    core.setOutput('matrix', matrixJson)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
