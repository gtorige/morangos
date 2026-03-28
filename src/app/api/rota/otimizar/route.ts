import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";

interface Waypoint {
  address: string;
  pedidoId?: number;
}

interface RoutesAPIResponse {
  routes?: Array<{
    optimizedIntermediateWaypointIndex?: number[];
    distanceMeters?: number;
    duration?: string;
    legs?: Array<{
      distanceMeters?: number;
      duration?: string;
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Routes API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const origin: string = body.origin;
    const waypoints: Waypoint[] = body.waypoints;

    if (!origin || !waypoints || waypoints.length === 0) {
      return NextResponse.json(
        { error: "Origin and waypoints are required" },
        { status: 400 }
      );
    }

    // For single waypoint, no optimization needed — just get route info
    const needsOptimization = waypoints.length > 1;

    // Build the Routes API request
    const routesRequest: Record<string, unknown> = {
      origin: {
        address: origin,
      },
      destination: {
        address: origin, // Return to origin
      },
      intermediates: waypoints.map((wp) => ({
        address: wp.address,
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "pt-BR",
      units: "METRIC",
    };

    if (needsOptimization) {
      routesRequest.optimizeWaypointOrder = true;
    }

    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": needsOptimization
            ? "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration"
            : "routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration",
        },
        body: JSON.stringify(routesRequest),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Google Routes API error:", errorData);
      return NextResponse.json(
        { error: "Google Routes API error", details: errorData },
        { status: res.status }
      );
    }

    const data: RoutesAPIResponse = await res.json();
    const route = data.routes?.[0];

    if (!route) {
      return NextResponse.json(
        { error: "No route found" },
        { status: 404 }
      );
    }

    // Map the optimized order back to pedido IDs
    const optimizedOrder = route.optimizedIntermediateWaypointIndex || waypoints.map((_, i) => i);
    const optimizedWaypoints = optimizedOrder.map((idx) => waypoints[idx]);

    // Parse total duration (e.g. "3600s" -> seconds)
    const parseDuration = (d: string | undefined) => {
      if (!d) return 0;
      const match = d.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    const durationSeconds = parseDuration(route.duration);
    const distanceKm = route.distanceMeters
      ? (route.distanceMeters / 1000).toFixed(1)
      : "0";

    // Per-leg info
    const legs = (route.legs || []).map((leg) => ({
      distanceKm: leg.distanceMeters
        ? (leg.distanceMeters / 1000).toFixed(1)
        : "0",
      durationMinutes: Math.round(parseDuration(leg.duration) / 60),
    }));

    // Separate delivery time (all legs except last which is return)
    const deliveryLegs = legs.length > 1 ? legs.slice(0, -1) : legs;
    const returnLeg = legs.length > 1 ? legs[legs.length - 1] : null;
    const deliveryDurationMinutes = deliveryLegs.reduce((a, l) => a + l.durationMinutes, 0);
    const deliveryDistanceKm = deliveryLegs.reduce((a, l) => a + parseFloat(l.distanceKm), 0).toFixed(1);

    return NextResponse.json({
      optimizedOrder,
      optimizedWaypoints,
      totalDistanceKm: distanceKm,
      totalDurationMinutes: Math.round(durationSeconds / 60),
      deliveryDistanceKm,
      deliveryDurationMinutes,
      returnDurationMinutes: returnLeg?.durationMinutes || 0,
      returnDistanceKm: returnLeg?.distanceKm || "0",
      legs,
    });
  } catch (error) {
    console.error("Erro ao otimizar rota:", error);
    return NextResponse.json(
      { error: "Erro ao otimizar rota" },
      { status: 500 }
    );
  }
}
