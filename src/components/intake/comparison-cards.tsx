import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { ComparisonOption } from "@/types/domain";

interface ComparisonCardsProps {
  options: ComparisonOption[];
}

export function ComparisonCards({ options }: ComparisonCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {options.map((option) => (
        <Card key={option.id} className="p-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{option.summary.title}</CardTitle>
            <Badge tone={option.is_selected ? "brand" : "neutral"}>{option.is_selected ? "Selected" : `Option ${option.option_number}`}</Badge>
          </div>

          <CardText className="mt-2">{option.summary.rationale}</CardText>

          <div className="mt-3 flex flex-wrap gap-1">
            {option.summary.vibeTags.map((tag) => (
              <Badge key={tag} tone="sun">
                {tag}
              </Badge>
            ))}
          </div>

          <p className="mt-3 text-sm font-semibold text-[var(--text)]">{formatIdr(option.summary.estimatedBudgetIdr)}</p>

          <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-soft)]">
            {option.summary.destinationHighlights.map((place) => (
              <li key={place}>{place}</li>
            ))}
          </ul>

          <button className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
            Pilih Opsi Ini
          </button>
        </Card>
      ))}
    </div>
  );
}
