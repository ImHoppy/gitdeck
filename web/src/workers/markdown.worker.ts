import { parseMarkdown } from './markdown/parse'

type Request = { id: number; text: string }

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, text } = e.data
  try {
    self.postMessage({ id, tree: parseMarkdown(text) })
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}
