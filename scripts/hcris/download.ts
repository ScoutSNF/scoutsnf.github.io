import { createWriteStream } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)

/** Streams a URL to disk -- never buffers the whole response in memory (these zips can be large). */
export async function downloadToFile(url: string, destPath: string): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true })
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${url} -> HTTP ${res.status}`)
  }
  const out = createWriteStream(destPath)
  await finished(Readable.fromWeb(res.body as import('stream/web').ReadableStream).pipe(out))
}

/** Extracts a zip via the system `unzip` binary (present on GitHub Actions ubuntu runners) into destDir. */
export async function extractZip(zipPath: string, destDir: string): Promise<string[]> {
  await mkdir(destDir, { recursive: true })
  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir])
  return readdir(destDir)
}

/** Finds the first extracted file whose name matches a case-insensitive suffix, e.g. "_RPT.CSV". */
export function findExtractedFile(files: string[], suffix: string): string | null {
  const lower = suffix.toLowerCase()
  return files.find((f) => f.toLowerCase().endsWith(lower)) ?? null
}
