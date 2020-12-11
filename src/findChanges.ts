import {promises as fs} from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {Context} from './context'

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

export async function gitDiff(diffBase: string): Promise<string> {
  core.info('Finding changed packages')
  const gitOutput = await execCommand('git', ['diff', '--name-only', diffBase])
  return gitOutput.stdout
}

export function getChangedDirectories(
  diffOutput: string,
  context: Context
): string[] {
  const directoryLevels: number = context.directoryLevels
    ? context.directoryLevels
    : -1
  const changedDirectories: string[] = diffOutput
    .split('\n')
    .map(line => {
      const parts = line.trim().split(path.sep)
      if (parts.length <= directoryLevels) {
        return null
      }
      const slice = parts.slice(0, directoryLevels)
      if (slice.length === 0) {
        return null
      }
      return slice.join(path.sep)
    })
    .filter(item => item) as string[]

  const uniqueDirectories = new Set(changedDirectories)
  return [...uniqueDirectories]
}

function range(start: number, end: number): number[] {
  const length = end - start
  return Array.from({length}, (_, i) => start + i)
}

export async function containsFileFilter(
  directory: string,
  filename: string
): Promise<string | null> {
  const directoryParts = directory.split(path.sep)
  const sliceRanges = range(1, directoryParts.length + 1)
  for (const slice of sliceRanges) {
    const directoryPart = directoryParts.slice(0, slice).join(path.sep)
    const filepath = path.join(directoryPart, filename)
    try {
      const stat = await fs.stat(filepath)
      if (stat.isFile()) {
        return directoryPart
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
  }
  return null
}

export function isExcludedFilter(directory: string, pattern: RegExp): boolean {
  return !!directory.match(pattern)
}

export async function filterGitOutputByFile(
  changedDirectories: string[],
  context: Context
): Promise<string[]> {
  const filteredDirectories: string[] = []

  for (const directory of changedDirectories) {
    if (!isExcludedFilter(directory, context.exclude)) {
      if (!context.directoryContaining) {
        filteredDirectories.push(directory)
      } else {
        const include = await containsFileFilter(
          directory,
          context.directoryContaining
        )
        if (include) {
          filteredDirectories.push(include)
        }
      }
    }
  }

  const uniqueDirectories = new Set(filteredDirectories)
  return [...uniqueDirectories]
}
