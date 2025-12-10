"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  maxTags = 20,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(s)
  );

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !value.includes(trimmedTag) && value.length < maxTags) {
      onChange([...value, trimmedTag]);
      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        addTag(filteredSuggestions[selectedSuggestionIndex]);
      } else if (inputValue) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
    setSelectedSuggestionIndex(0);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-[44px] flex-wrap gap-2 rounded-lg border bg-background p-2",
          "transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="rounded-full p-0.5 hover:bg-primary/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && inputValue && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border bg-popover shadow-lg">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              className={cn(
                "w-full px-4 py-2 text-left text-sm hover:bg-accent",
                index === selectedSuggestionIndex && "bg-accent"
              )}
              onClick={() => addTag(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {value.length >= maxTags && (
        <p className="mt-1 text-xs text-muted-foreground">
          Maximum {maxTags} tags allowed
        </p>
      )}
    </div>
  );
}
