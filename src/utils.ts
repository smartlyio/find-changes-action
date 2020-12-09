import {promises as fs} from 'fs'
import * as core from '@actions/core'
import * as exec from '@actions/exec'

interface GitResult {
  stdout: string
  stderr: string
}

async function execCommand(
  command: string,
  args: string[]
): Promise<GitResult> {
  let stderr = ''
  let stdout = ''
  const options: exec.ExecOptions = {}
  options.listeners = {
    stdout: (data: Buffer) => {
      stdout += data.toString()
    },
    stderr: (data: Buffer) => {
      stderr += data.toString()
    }
  }
  await exec.exec(command, args, options)
  core.debug(`Stderr from git: ${stderr}`)
  return {stdout, stderr}
}

export async function getBranchPoint(): Promise<string> {
  if (process.env['GITHUB_EVENT_NAME'] === 'pull_request') {
    const eventPath = process.env['GITHUB_EVENT_PATH']
    core.info(`Reading event from ${eventPath}`)
    if (!eventPath) {
      throw new Error(
        'Could not find event payload file to determine branch point.'
      )
    }
    const eventData: Buffer = await fs.readFile(eventPath)
    const event = JSON.parse(eventData.toString())
    if (
      event &&
      event.pull_request &&
      event.pull_request.base &&
      event.pull_request.base.sha
    ) {
      core.info(`Found branch point ${event.pull_request.base.sha}`)
      return event.pull_request.base.sha as string
    } else {
      throw new Error(
        'Event payload does not provide the HEAD SHA. Unable to determine branch point to compare changes.'
      )
    }
  } else {
    throw new Error('find-changed-packages only works on pull_request events')
  }
}

export async function gitDiff(): Promise<string> {
  core.info('Finding changed packages')
  const diffBase = await getBranchPoint()
  const gitOutput = await execCommand('git', ['diff', '--name-only', diffBase])
  return gitOutput.stdout
}

export function filterGitOutput(gitOutput: string): string[] {
  const packageNames: string[] = gitOutput
    .split('\n')
    .map(line => {
      const parts = line.trim().split('/')
      if (parts.length === 1) {
        return null
      }
      return parts[0]
    })
    .filter(item => item) as string[]
  const uniquePackageNames = new Set(
    packageNames.filter(packageName => {
      if (packageName.match(/^00_.*/) || packageName === '.github') {
        return false
      }
      return true
    })
  )

  return [...uniquePackageNames]
}
