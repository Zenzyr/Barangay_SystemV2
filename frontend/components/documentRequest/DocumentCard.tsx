import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: LucideIcon;
  onClick: () => void;
  isSelected: boolean;
}

export function DocumentCard({ id, title, description, price, icon: Icon, onClick, isSelected }: DocumentCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md border-slate-200",
        isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="size-10 rounded-lg bg-teal-50 flex items-center justify-center">
            <Icon className="size-5 text-primary" />
        </div>
        <Badge variant="secondary" className="bg-teal-100 text-teal-800 hover:bg-teal-100">
          ₱{price}
        </Badge>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-lg font-semibold mb-2">{title}</CardTitle>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{description}</p>
        <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
          Request Document →
        </Button>
      </CardContent>
    </Card>
  );
}
