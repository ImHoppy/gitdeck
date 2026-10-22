const IMAGE = /\.(png|jpe?g|gif|webp|bmp|ico|svg|avif)$/i

export const isImage = (path: string) => IMAGE.test(path)
