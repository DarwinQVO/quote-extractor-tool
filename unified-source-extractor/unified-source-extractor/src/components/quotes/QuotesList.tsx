"use client";

import React from "react";
import { Quote } from "@/lib/types";
import { QuoteCard } from "./QuoteCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Quote as QuoteIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuotesListProps {
  quotes: Quote[];
  onQuoteSelect?: (quote: Quote) => void;
  onQuoteEdit?: (quote: Quote) => void;
  onQuoteDelete?: (quoteId: string) => void;
  onAddQuote?: () => void;
  className?: string;
}

export function QuotesList({
  quotes,
  onQuoteSelect,
  onQuoteEdit,
  onQuoteDelete,
  onAddQuote,
  className
}: QuotesListProps) {
  if (quotes.length === 0) {
    return (
      <EmptyState
        icon={QuoteIcon}
        title="No quotes yet"
        description="Start adding quotes to your sources to build your collection"
        action={onAddQuote ? {
          label: "Add Quote",
          onClick: onAddQuote
        } : undefined}
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {quotes.map((quote) => (
        <QuoteCard
          key={quote.id}
          quote={quote}
          onSelect={onQuoteSelect}
          onEdit={onQuoteEdit}
          onDelete={onQuoteDelete}
        />
      ))}
    </div>
  );
}