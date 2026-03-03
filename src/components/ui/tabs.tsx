"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  tabValues: string[];
  registerTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType>({
  value: "",
  onValueChange: () => {},
  tabValues: [],
  registerTab: () => {},
});

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

function Tabs({ value, onValueChange, className, ...props }: TabsProps) {
  const [tabValues, setTabValues] = React.useState<string[]>([]);

  const registerTab = React.useCallback((tabValue: string) => {
    setTabValues((prev) => {
      if (prev.includes(tabValue)) return prev;
      return [...prev, tabValue];
    });
  }, []);

  return (
    <TabsContext.Provider value={{ value, onValueChange, tabValues, registerTab }}>
      <div className={cn("", className)} {...props} />
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isSelected = context.value === value;

    // Register this tab value on mount
    React.useEffect(() => {
      context.registerTab(value);
    }, [value, context.registerTab]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const { tabValues, onValueChange } = context;
      const currentIndex = tabValues.indexOf(value);
      if (currentIndex === -1) return;

      let nextIndex = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabValues.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabValues.length) % tabValues.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = tabValues.length - 1;
      }

      if (nextIndex >= 0) {
        onValueChange(tabValues[nextIndex]);
        // Focus the next tab button
        const tablist = (e.target as HTMLElement).closest('[role="tablist"]');
        if (tablist) {
          const buttons = tablist.querySelectorAll('[role="tab"]');
          (buttons[nextIndex] as HTMLElement)?.focus();
        }
      }
    };

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isSelected && "bg-background text-foreground shadow-sm",
          className
        )}
        onClick={() => context.onValueChange(value)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (context.value !== value) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        tabIndex={0}
        className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
        {...props}
      />
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
