// App.tsx
/*
'use client';
import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { backendUrl } from "@/app/utils/url";
import axios from "axios"
import { useQuery } from "@tanstack/react-query";



const App: React.FC = () => {
 
  const initialPosition: L.LatLngExpression = [13.561863374109878, 124.24571984929331]; 

  const now = new Date();
  const currentDate = now.toISOString().split("T")[0];


  const { data: fisherfolks, isLoading, isError, error } = useQuery({
    queryKey: ['fisherfolk_data'],
    queryFn: async (): Promise<getFisherfolkInterface[]> => {
      const response = await axios.get(backendUrl(`/fisherfolk`));
      response.data.reverse()
      return response.data;
    }
  });



  const customIcon = L.icon({   
    iconUrl: `/house.png`,
    iconSize: [32, 32], // size of the icon
    iconAnchor: [16, 32], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -32], // point from which the popup should open relative to the iconAnchor
  });

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer center={initialPosition} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {
            fisherfolks?.map((fisherfolk) => (
              <Marker key={fisherfolk._id} position={[Number(fisherfolk.lat), Number(fisherfolk.long)]}  icon={customIcon}>
              <Popup className="w-[420px]">
                <div className="max-h-[360px] overflow-y-auto hide-scrollbar p-3 space-y-4 text-sm">

                  
                  <div className="border-b pb-2">
                    <p className="text-base font-semibold text-gray-800">
                      {fisherfolk.fullname}
                    </p>
                    
                  </div>

              
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <p><span className="font-medium text-gray-600">Contact:</span> {fisherfolk.contact}</p>
                    <p><span className="font-medium text-gray-600">Email:</span> {fisherfolk.email}</p>
                    <p><span className="font-medium text-gray-600">Gender:</span> {fisherfolk.gender}</p>
                    <p><span className="font-medium text-gray-600">Barangay:</span> {fisherfolk.barangay}</p>

                    <p className="sm:col-span-2">
                      <span className="font-medium text-gray-600">Address:</span>{" "}
                      {fisherfolk.address}
                    </p>

                    <p>
                      <span className="font-medium text-gray-600">Civil Status:</span>{" "}
                      {fisherfolk.civilStatus}
                    </p>

                    <p className="sm:col-span-2">
                      <span className="font-medium text-gray-600">Person to Notify:</span>{" "}
                      {fisherfolk.personToNotify}
                    </p>
                  </div>

      
                 

                </div>
              </Popup>


              </Marker>
            ))
        }
      
      </MapContainer>
    </div>
  );
};

export default App; 


*/