import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("", className)}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-start justify-between gap-3 py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="text-left space-y-0.5">
            <h4 className="text-base font-semibold tracking-tight">{title}</h4>
            {subtitle && (
              <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
            )}
          </div>
          <ChevronDown 
            className={cn(
              "w-5 h-5 text-muted-foreground shrink-0 mt-1 transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
        <div className="pt-3 pb-1 space-y-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

