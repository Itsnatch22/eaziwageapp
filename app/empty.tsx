"use client";

import React from "react";
import { 
  Inbox, 
  Search, 
  Plus, 
  ArrowRight,
  LucideIcon 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  variant?: "default" | "search" | "simple";
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  variant = "default"
}: EmptyStateProps) {
  
  const isSearch = variant === "search";
  const DisplayIcon = isSearch ? Search : Icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center px-4 py-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500",
      className
    )}>
      <div className={cn(
        "mb-6 relative group",
        isSearch ? "bg-amber-100 dark:bg-amber-900/20" : "bg-primary/10",
        "w-20 h-20 rounded-3xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
      )}>
        <DisplayIcon className={cn(
          "w-10 h-10 transition-colors duration-300",
          isSearch ? "text-amber-600" : "text-primary"
        )} />
        
        
        <div className="absolute -inset-2 bg-current opacity-5 rounded-full blur-xl group-hover:opacity-10 transition-opacity" />
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mb-8">
          {description}
        </p>
      )}

      {action && (
        <div className="flex justify-center">
          {action.href ? (
            <Link href={action.href}>
              <Button className="bg-primary text-white rounded-xl px-6 h-11 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                {action.label}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          ) : (
            <Button 
              onClick={action.onClick}
              className="bg-primary text-white rounded-xl px-6 h-11 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="mr-2 w-4 h-4" />
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export const NoResults = (props: Partial<EmptyStateProps>) => (
  <EmptyState 
    variant="search" 
    title="No results found" 
    description="We couldn't find what you were looking for. Try adjusting your filters or search terms."
    {...props} 
  />
);

export const ComingSoon = (props: Partial<EmptyStateProps>) => (
  <EmptyState 
    icon={Sparkles} 
    title="Coming Soon" 
    description="We're working hard to bring this feature to life. Stay tuned for updates!"
    {...props} 
  />
);

import { Sparkles } from "lucide-react";
