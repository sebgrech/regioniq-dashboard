"use client"

import { useEffect, useState, useRef } from "react"
import { Map, Marker, NavigationControl } from "@vis.gl/react-mapbox"
import { useTheme } from "next-themes"
import { MapPin, Loader2 } from "lucide-react"
import "mapbox-gl/dist/mapbox-gl.css"

// Stable mapbox lib reference to prevent re-initialization
const MAPBOX_LIB = import("mapbox-gl")

interface AssetLocationMapProps {
  postcode: string
  address?: string
  className?: string
}

interface GeocodedLocation {
  lat: number
  lng: number
  placeName: string
}

export function AssetLocationMap({ postcode, address, className }: AssetLocationMapProps) {
  const { theme } = useTheme()
  const [location, setLocation] = useState<GeocodedLocation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mapRef = useRef<any>(null)
  
  // Geocode the postcode on mount
  useEffect(() => {
    async function geocodePostcode() {
      if (!postcode) {
        setError("No postcode provided")
        setIsLoading(false)
        return
      }
      
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) {
          setError("Map configuration missing")
          setIsLoading(false)
          return
        }
        
        // Use Mapbox Geocoding API
        const query = encodeURIComponent(`${postcode}, United Kingdom`)
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=GB&types=postcode,address&limit=1`
        )
        
        if (!response.ok) {
          throw new Error("Geocoding failed")
        }
        
        const data = await response.json()
        
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center
          setLocation({
            lat,
            lng,
            placeName: data.features[0].place_name,
          })
        } else {
          setError("Location not found")
        }
      } catch (err) {
        console.error("Geocoding error:", err)
        setError("Unable to load map")
      } finally {
        setIsLoading(false)
      }
    }
    
    geocodePostcode()
  }, [postcode])
  
  // Map style based on theme - using streets (colored) style
  const mapStyle = theme === "dark" 
    ? "mapbox://styles/mapbox/navigation-night-v1"
    : "mapbox://styles/mapbox/streets-v12"
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`relative rounded-xl overflow-hidden bg-muted/30 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error || !location) {
    return (
      <div className={`relative rounded-xl overflow-hidden bg-muted/30 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{error || "Map unavailable"}</p>
            {postcode && (
              <p className="text-xs mt-1 opacity-70">{postcode}</p>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      <Map
        ref={mapRef}
        mapLib={MAPBOX_LIB}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: location.lat,
          longitude: location.lng,
          zoom: 14,
          pitch: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        attributionControl={false}
        logoPosition="bottom-right"
      >
        {/* Navigation controls */}
        <NavigationControl position="top-right" showCompass={false} />
        
        {/* Asset marker */}
        <Marker
          latitude={location.lat}
          longitude={location.lng}
          anchor="bottom"
        >
          <div className="relative group">
            {/* Pulse animation */}
            <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping" />
            
            {/* Main pin */}
            <div className="relative flex items-center justify-center w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                <p className="text-xs font-medium text-foreground">{postcode}</p>
                {address && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
                    {address}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Marker>
      </Map>
      
      {/* Postcode badge overlay */}
      <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
        <p className="text-xs font-medium text-foreground">{postcode}</p>
      </div>
    </div>
  )
}
