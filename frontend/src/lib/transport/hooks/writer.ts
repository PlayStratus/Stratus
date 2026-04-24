const closingWriters = new WeakSet<WritableStreamDefaultWriter<Uint8Array>>()

export async function closeWriterSafely(
  writer: WritableStreamDefaultWriter<Uint8Array> | null,
  onUnexpectedError: (error: unknown) => void,
) {
  if (!writer) return

  if (closingWriters.has(writer) || isWriterNotWritable(writer)) {
    releaseWriterLock(writer)
    return
  }

  closingWriters.add(writer)
  try {
    await writer.close()
  } catch (error) {
    if (!isWriterNotWritable(writer) && !(await hasWriterClosed(writer))) {
      onUnexpectedError(error)
    }
  } finally {
    closingWriters.delete(writer)
    releaseWriterLock(writer)
  }
}

export function releaseWriterLock(
  writer: WritableStreamDefaultWriter<Uint8Array>,
) {
  try {
    writer.releaseLock()
  } catch {
    // The writer may already be released by a competing cleanup path.
  }
}

function isWriterNotWritable(writer: WritableStreamDefaultWriter<Uint8Array>) {
  try {
    return writer.desiredSize === null
  } catch {
    return true
  }
}

async function hasWriterClosed(
  writer: WritableStreamDefaultWriter<Uint8Array>,
) {
  let settled = false
  writer.closed.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )

  await Promise.resolve()
  return settled
}
