import { useState } from 'react'
import { useMarkdownCtx } from './context'
import { resolveHref } from './links'
import styles from './Markdown.module.css'

type Props = { url: string; alt: string; width?: string; height?: string; maybeVideo?: boolean }

/**
 * A picture through gitd's proxy, lazy and capped in width; a click opens it full size. An
 * attachment link may be a video: when it isn't a picture it plays instead.
 */
export function MdImage({ url, alt, width, height, maybeVideo }: Props) {
  const ctx = useMarkdownCtx()
  const [failed, setFailed] = useState(false)
  const absolute = resolveHref(url, ctx, true)
  const src = absolute ? ctx.image(absolute) : null
  if (!src) return <span className={styles.missing}>{alt || url}</span>
  if (failed && maybeVideo) return <video className={styles.media} src={src} controls preload="metadata" />
  if (failed) return <span className={styles.missing} title={url}>{alt || 'image'}</span>
  return (
    <img
      className={styles.media}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
      onClick={() => ctx.openImage(src, alt)}
    />
  )
}
