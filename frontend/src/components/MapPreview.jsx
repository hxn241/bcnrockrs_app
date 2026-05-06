import GoogleMapEmbed from './GoogleMapEmbed'

export default function MapPreview({ url, embedUrl, title }) {
  return <GoogleMapEmbed url={url} embedUrl={embedUrl} title={title} />
}
