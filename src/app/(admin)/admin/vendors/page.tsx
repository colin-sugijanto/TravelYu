import { Card, CardText, CardTitle } from "@/components/ui/card";

const vendors = [
  { name: "Ubud Green Villa", type: "villa", city: "Ubud", verified: true },
  { name: "Laut Senja Resto", type: "restaurant", city: "Jimbaran", verified: true },
  { name: "Bromo Jeep Operator", type: "experience", city: "Malang", verified: false },
];

export default function AdminVendorsPage() {
  return (
    <Card className="p-5">
      <CardTitle>Vendor Management</CardTitle>
      <CardText className="mt-1">CRUD vendor untuk itinerary engine dan vendor swap tool.</CardText>
      <div className="mt-3 space-y-2">
        {vendors.map((vendor) => (
          <div key={vendor.name} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{vendor.name}</span>
              <span className="text-[var(--text-soft)]">{vendor.type}</span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">
              {vendor.city} · {vendor.verified ? "verified" : "pending"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
