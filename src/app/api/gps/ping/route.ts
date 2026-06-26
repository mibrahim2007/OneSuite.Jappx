import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  gpsDevices,
  vehiclePositions,
  gpsTripSegments,
  geofences,
  geofenceAlerts,
} from "@/lib/db/schema";
import { gpsPingSchema } from "@/lib/validations/gps";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  // Auth header existence check first — avoids leaking validation details to unauthenticated callers
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "Missing x-api-key header." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = gpsPingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { device_id, lat, lng, speed, heading, odometer, event_type, timestamp } = parsed.data;

  // Look up device — apiKey matched here to authenticate
  const [device] = await db
    .select()
    .from(gpsDevices)
    .where(and(eq(gpsDevices.deviceId, device_id), eq(gpsDevices.apiKey, apiKey)))
    .limit(1);

  if (!device || !device.isActive) {
    return NextResponse.json({ error: "Unknown or inactive device." }, { status: 403 });
  }

  if (!device.vehicleId) {
    return NextResponse.json({ error: "Device not assigned to a vehicle." }, { status: 422 });
  }

  const recordedAt = timestamp ? new Date(timestamp) : new Date();
  const tenantId = device.tenantId;
  const vehicleId = device.vehicleId;

  await db.transaction(async (tx) => {
    // Insert position ping
    await tx.insert(vehiclePositions).values({
      tenantId,
      vehicleId,
      deviceId: device.id,
      recordedAt,
      lat: String(lat),
      lng: String(lng),
      speedKmh: speed != null ? String(speed) : null,
      heading: heading != null ? String(heading) : null,
      odometerKm: odometer != null ? String(odometer) : null,
      eventType: event_type ?? "moving",
    });

    // Trip segment auto-detection from ignition events
    if (event_type === "ignition_on") {
      await tx.insert(gpsTripSegments).values({
        tenantId,
        vehicleId,
        deviceId: device.id,
        startTime: recordedAt,
        startLat: String(lat),
        startLng: String(lng),
      });
    } else if (event_type === "ignition_off") {
      // Close the most recent open segment for this vehicle
      const [openSeg] = await tx
        .select({
          id: gpsTripSegments.id,
          startLat: gpsTripSegments.startLat,
          startLng: gpsTripSegments.startLng,
        })
        .from(gpsTripSegments)
        .where(
          and(
            eq(gpsTripSegments.vehicleId, vehicleId),
            eq(gpsTripSegments.tenantId, tenantId),
            isNull(gpsTripSegments.endTime)
          )
        )
        .orderBy(desc(gpsTripSegments.startTime))
        .limit(1);

      if (openSeg) {
        // Guard against NULL startLat/startLng — schema allows null, distance falls back to 0
        const sLat = openSeg.startLat != null ? parseFloat(openSeg.startLat) : null;
        const sLng = openSeg.startLng != null ? parseFloat(openSeg.startLng) : null;
        const distKm =
          sLat != null && sLng != null ? haversineMeters(sLat, sLng, lat, lng) / 1000 : 0;

        await tx
          .update(gpsTripSegments)
          .set({
            endTime: recordedAt,
            endLat: String(lat),
            endLng: String(lng),
            distanceKm: String(distKm.toFixed(2)),
          })
          .where(eq(gpsTripSegments.id, openSeg.id));
      }
    }

    // Geofence checks (circle only) — batch last-alert lookup to avoid N+1 query per fence
    const fences = await tx
      .select()
      .from(geofences)
      .where(and(eq(geofences.tenantId, tenantId), eq(geofences.isActive, true)));

    const activeFences = fences.filter(
      (f) => f.type === "circle" && f.centerLat && f.centerLng && f.radiusM
    );

    if (activeFences.length > 0) {
      // Single query: latest alert per geofence for this vehicle
      const recentAlerts = await tx
        .selectDistinctOn([geofenceAlerts.geofenceId], {
          geofenceId: geofenceAlerts.geofenceId,
          eventType: geofenceAlerts.eventType,
        })
        .from(geofenceAlerts)
        .where(
          and(
            eq(geofenceAlerts.tenantId, tenantId),
            eq(geofenceAlerts.vehicleId, vehicleId),
            inArray(
              geofenceAlerts.geofenceId,
              activeFences.map((f) => f.id)
            )
          )
        )
        .orderBy(geofenceAlerts.geofenceId, desc(geofenceAlerts.triggeredAt));

      const lastAlertMap = new Map(recentAlerts.map((a) => [a.geofenceId, a.eventType]));

      for (const fence of activeFences) {
        const dist = haversineMeters(
          parseFloat(fence.centerLat!),
          parseFloat(fence.centerLng!),
          lat,
          lng
        );
        const inside = dist <= parseFloat(fence.radiusM!);
        const wasInside = lastAlertMap.get(fence.id) === "enter";

        if (inside && !wasInside) {
          await tx.insert(geofenceAlerts).values({
            tenantId,
            geofenceId: fence.id,
            vehicleId,
            eventType: "enter",
            triggeredAt: recordedAt,
            lat: String(lat),
            lng: String(lng),
          });
        } else if (!inside && wasInside) {
          await tx.insert(geofenceAlerts).values({
            tenantId,
            geofenceId: fence.id,
            vehicleId,
            eventType: "exit",
            triggeredAt: recordedAt,
            lat: String(lat),
            lng: String(lng),
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
