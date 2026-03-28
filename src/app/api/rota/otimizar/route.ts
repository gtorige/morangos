import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getGoogleRoutesApiKey } from "@/lib/config";

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

    const apiKey = await getGoogleRoutesApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Routes API key não configurada. Acesse Configurações para adicionar." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const origin: string = body.origin;
    const waypoints: Waypoint[] = body.waypoints;
    const paradas: { endereco: string }[] = body.paradas || [];

    if (!origin || !waypoints || waypoints.length === 0) {
      return NextResponse.json(
        { error: "Origin and waypoints are required" },
        { status: 400 }
      );
    }

    // Combine delivery waypoints with additional paradas (stops)
    const allIntermediates = [
      ...waypoints.map((wp) => ({ address: wp.address })),
      ...paradas.filter((p) => p.endereco?.trim()).map((p) => ({ address: p.endereco.trim() })),
    ];

    // For single waypoint, no optimization needed — just get route info
    const needsOptimization = allIntermediates.length > 1;

    // Build the Routes API request
    const routesRequest: Record<string, unknown> = {
      origin: {
        address: origin,
      },
      destination: {
        address: origin, // Return to origin
      },
      intermediates: allIntermediates,
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
      console.error("Google Routes API error:", JSON.stringify(errorData, null, 2));

      // Check for geocoding errors and provide helpful message
      const errorMessage = errorData?.error?.message || "";
      const status = errorData?.error?.status || "";

      let userMessage = "Erro na API do Google Routes.";
      if (status === "INVALID_ARGUMENT" || errorMessage.includes("geocod")) {
        userMessage = "Endereço não encontrado. Use endereços completos (rua, número, cidade) em vez de nomes de locais.";
      } else if (status === "PERMISSION_DENIED") {
        userMessage = "API Key sem permissão. Verifique se a Routes API está ativada no Google Cloud Console.";
      }

      return NextResponse.json(
        { error: userMessage, details: errorData },
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
    // allIntermediates = [...waypoints (pedidos), ...paradas]
    // Google returns indices into allIntermediates
    const optimizedOrder = route.optimizedIntermediateWaypointIndex || allIntermediates.map((_, i) => i);
    const numPedidos = waypoints.length;
    // Filter out parada indices and map back to waypoints
    const optimizedWaypoints = optimizedOrder
      .filter((idx: number) => idx < numPedidos)
      .map((idx: number) => waypoints[idx]);

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
