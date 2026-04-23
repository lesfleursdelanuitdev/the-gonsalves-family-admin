import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";

interface CardActionFooterProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CardActionFooter({ onView, onEdit, onDelete }: CardActionFooterProps) {
  if (!onView && !onEdit && !onDelete) return null;
  return (
    <CardFooter>
      {onView && (
        <Button variant="ghost" size="icon-xs" onClick={onView}>
          <Eye className="size-3.5" />
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="icon-xs" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="icon-xs" onClick={onDelete}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      )}
    </CardFooter>
  );
}
