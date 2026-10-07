import { Image, type ImageContentFit } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { authedImageSource } from '../lib/api'

/**
 * A protected bill photo (/uploads/…): the request carries the login token, and the server answers
 * with a short-lived link to the stored file. Lists render these lazily (only rows on screen
 * load), like the web app's lazy thumbnails.
 */
export function AuthImage({ src, fit = 'cover' }: { src: string; fit?: ImageContentFit }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <View style={StyleSheet.absoluteFill} />
  return (
    <Image
      source={authedImageSource(src)}
      style={StyleSheet.absoluteFill}
      contentFit={fit}
      cachePolicy="memory-disk"
      recyclingKey={src}
      transition={150}
      onError={() => setFailed(true)}
    />
  )
}
