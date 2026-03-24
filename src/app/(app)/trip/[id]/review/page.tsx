import { Card, CardText, CardTitle } from "@/components/ui/card";

export default function TripReviewPage() {
  return (
    <Card className="max-w-3xl p-5">
      <CardTitle>Post-trip Vendor Review</CardTitle>
      <CardText className="mt-1">Rate vendor 1-5 stars dan tulis feedback untuk membantu traveler berikutnya.</CardText>

      <form className="mt-4 space-y-3">
        <input className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm" placeholder="Nama vendor" />
        <select className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm">
          <option>Rating 5</option>
          <option>Rating 4</option>
          <option>Rating 3</option>
          <option>Rating 2</option>
          <option>Rating 1</option>
        </select>
        <textarea className="min-h-32 w-full rounded-xl border border-[var(--border)] p-3 text-sm" placeholder="Bagaimana pengalamanmu?" />
        <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Submit Review</button>
      </form>
    </Card>
  );
}
