"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, DataTable, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LocationZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
};

/** Geofence location zone management with map pin coordinates */
export default function LocationZonesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("100");
  const [isActive, setIsActive] = useState(true);

  const { data: zones, isLoading } = useQuery({
    queryKey: ["location-zones"],
    queryFn: async () => {
      const res = await fetch("/api/settings/location-zones");
      const json = await res.json();
      return json.data as LocationZone[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/location-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radiusMeters: parseInt(radiusMeters, 10),
          isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-zones"] });
      setShowForm(false);
      setName("");
      setLat("");
      setLng("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/settings/location-zones/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["location-zones"] }),
  });

  /** Use browser geolocation to set zone center coordinates */
  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }

  return (
    <div>
      <PageHeader
        title="Location Zones"
        description="Configure geofence zones for mobile clock-in"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle>New Location Zone</CardTitle></CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>Zone Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Office" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="34.0522" />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-118.2437" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
              Use Current Location
            </Button>
            <div className="space-y-2">
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
              Active
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name || !lat || !lng}
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !zones?.length ? (
        <EmptyState
          title="No location zones"
          description="Add geofence zones to enable mobile clock-in from approved locations."
        />
      ) : (
        <DataTable>
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Coordinates</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Radius</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-b">
                <td className="px-4 py-3 font-medium">{zone.name}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                </td>
                <td className="px-4 py-3">{zone.radiusMeters}m</td>
                <td className="px-4 py-3">
                  <Badge variant={zone.isActive ? "success" : "secondary"}>
                    {zone.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete ${zone.name}?`)) deleteMutation.mutate(zone.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
