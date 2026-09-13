"use client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';



interface ClickableMapProps {
    mapLocation : { lat: number; long: number } | null,
    setMapLocation?: React.Dispatch<React.SetStateAction<{ lat: number; long: number } | null>>;
}
const customIcon = L.icon({   
    iconUrl: `/house.png`,
    iconSize: [32, 32], 
    iconAnchor: [16, 32], 
    popupAnchor: [0, -32], 
  });
  

const MapClickHandler: React.FC<Pick<ClickableMapProps, "setMapLocation">> = ({ setMapLocation }) => {
  useMapEvents({
    click(e) {
      if (!setMapLocation) return;
      setMapLocation({
        lat: e.latlng.lat,
        long: e.latlng.lng,
      });
    },
  });
  return null;
};

const MapLocation: React.FC<ClickableMapProps>  = ({ setMapLocation, mapLocation }) => {
  
  const initialPosition: L.LatLngExpression = [13.561863374109878, 124.24571984929331];
  const [open, setOpen] = useState(false);

    
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
            <Button className={`flex items-center gap-2 ${mapLocation ? "bg-green-500" : "bg-gray-700"}` } onClick={() => setOpen(true)}>
                Pin Location
            </Button>
      </DialogTrigger>
      <DialogHeader>
          <DialogTitle>     </DialogTitle>
          <DialogDescription>   
           
          </DialogDescription>
        </DialogHeader>
      <DialogContent className="sm:max-w-[825px] h-[600px]">

    
        <div className=" gap-6 w-full h-[500px] mt-10">
         
        <MapContainer center={initialPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler setMapLocation={setMapLocation} />
        {mapLocation && (
            <Marker position={[mapLocation.lat, mapLocation.long]} icon={customIcon}>
            <Popup>
                  fisherfolk house
            </Popup>
            </Marker>
        )}
        </MapContainer>

       
        </div>

      
      </DialogContent>
    </Dialog>
  )
}


export default MapLocation;
