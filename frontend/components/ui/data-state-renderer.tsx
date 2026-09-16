import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function DataError({ message, refetch }: { message: string; refetch: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-3 rounded-full bg-destructive/10 mb-3">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">Unable to load data</h3>
      <p className="text-xs text-gray-500 mt-1 mb-4 max-w-xs">{message}</p>
      <Button variant="outline" size="sm" onClick={refetch}>Try Again</Button>
    </div>
  );
}

export function DataEmpty({ title, description, icon: Icon, action }: { title: string; description: string; icon?: React.ElementType; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-gray-400 py-12">
      {Icon && <Icon className="size-8" />}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
