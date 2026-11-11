const cleanPostcode = (value: string) => value.toUpperCase().replace(/\s/g, "");

type PostcodeResponse = {
  status: number;
  result?: { latitude: number; longitude: number };
  error?: string;
};

type RouteResponse = {
  code: string;
  routes?: Array<{ distance: number; duration: number }>;
  message?: string;
};

const coordinatesFor = async (postcode: string) => {
  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode(postcode))}`);
  const payload = await response.json() as PostcodeResponse;
  if (!response.ok || !payload.result) throw new Error(payload.error || "Postcode invalid");
  return payload.result;
};

export const calculateDirectRouteMiles = async (pickupPostcode: string, deliveryPostcode: string) => {
  if (!pickupPostcode.trim() || !deliveryPostcode.trim()) throw new Error("Both postcodes are required");
  const [pickup, delivery] = await Promise.all([coordinatesFor(pickupPostcode), coordinatesFor(deliveryPostcode)]);
  const coordinates = `${pickup.longitude},${pickup.latitude};${delivery.longitude},${delivery.latitude}`;
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&alternatives=false`);
  const payload = await response.json() as RouteResponse;
  const route = payload.routes?.[0];
  if (!response.ok || payload.code !== "Ok" || !route) throw new Error(payload.message || "Route unavailable");
  return {
    miles: Math.round((route.distance / 1609.344 + Number.EPSILON) * 10) / 10,
    minutes: Math.round(route.duration / 60)
  };
};
