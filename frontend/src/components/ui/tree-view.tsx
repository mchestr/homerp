"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode {
  id: string;
  name: string;
  icon?: string | null;
  children?: TreeNode[];
  item_count?: number;
  total_value?: number;
}

interface TreeViewProps<T extends TreeNode> {
  nodes: T[];
  selectedId?: string | null;
  onSelect?: (node: T) => void;
  onMove?: (nodeId: string, newParentId: string | null) => void;
  renderActions?: (node: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

interface TreeItemProps<T extends TreeNode> {
  node: T;
  level: number;
  selectedId?: string | null;
  onSelect?: (node: T) => void;
  onMove?: (nodeId: string, newParentId: string | null) => void;
  renderActions?: (node: T) => React.ReactNode;
  allNodes: T[];
}

function TreeItem<T extends TreeNode>({
  node,
  level,
  selectedId,
  onSelect,
  renderActions,
}: TreeItemProps<T>) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
          "hover:bg-accent cursor-pointer",
          isSelected && "border-primary bg-accent border-l-2"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect?.(node)}
      >
        {/* Expand/Collapse */}
        <button
          type="button"
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded transition-transform",
            hasChildren ? "hover:bg-accent-foreground/10" : "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              expanded && "rotate-90"
            )}
          />
        </button>

        {/* Icon */}
        {node.icon && <span className="text-base">{node.icon}</span>}

        {/* Name */}
        <span className="flex-1 truncate text-sm font-medium">{node.name}</span>

        {/* Stats badges */}
        <div className="flex items-center gap-1.5">
          {typeof node.item_count === "number" && node.item_count > 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              {node.item_count}
            </span>
          )}
          {typeof node.total_value === "number" && node.total_value > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              $
              {node.total_value.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          )}
        </div>

        {/* Actions */}
        {renderActions && (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            {renderActions(node)}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {(node.children as T[]).map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              renderActions={renderActions}
              allNodes={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView<T extends TreeNode>({
  nodes,
  selectedId,
  onSelect,
  onMove,
  renderActions,
  emptyMessage = "No items",
  className,
}: TreeViewProps<T>) {
  if (nodes.length === 0) {
    return (
      <div className={cn("text-muted-foreground py-8 text-center", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          level={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onMove={onMove}
          renderActions={renderActions}
          allNodes={nodes}
        />
      ))}
    </div>
  );
}

// Tree select component for forms (dropdown-style)
interface TreeSelectProps<T extends TreeNode> {
  nodes: T[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  excludeId?: string; // Exclude a node and its descendants (for parent selection)
  className?: string;
}

export function TreeSelect<T extends TreeNode>({
  nodes,
  value,
  onChange,
  placeholder = "Select...",
  allowClear = true,
  excludeId,
  className,
}: TreeSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update dropdown position when opened
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  // Update position on open and window resize/scroll
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Flatten tree for easy lookup
  const flattenTree = (items: T[], level = 0): Array<T & { level: number }> => {
    return items.flatMap((item) => {
      if (excludeId && item.id === excludeId) return [];
      const result: Array<T & { level: number }> = [{ ...item, level }];
      if (item.children && item.children.length > 0) {
        result.push(...flattenTree(item.children as T[], level + 1));
      }
      return result;
    });
  };

  const flatNodes = flattenTree(nodes);
  const selectedNode = flatNodes.find((n) => n.id === value);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "bg-background flex h-11 w-full items-center justify-between rounded-lg border px-4 text-left text-base",
          "focus:border-primary focus:ring-primary/20 transition-colors focus:ring-2 focus:outline-hidden",
          !selectedNode && "text-muted-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
        data-testid="tree-select-trigger"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedNode ? (
            <>
              {selectedNode.icon && <span>{selectedNode.icon}</span>}
              {selectedNode.name}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronRight
          className={cn(
            "text-muted-foreground h-4 w-4 transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </button>

      {isOpen &&
        dropdownPosition &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50"
              onClick={() => setIsOpen(false)}
              data-testid="tree-select-backdrop"
            />

            {/* Dropdown */}
            <div
              ref={dropdownRef}
              className="bg-popover fixed z-50 max-h-64 overflow-auto rounded-lg border shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
              data-testid="tree-select-dropdown"
            >
              {allowClear && value && (
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-accent w-full px-4 py-2 text-left text-sm"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  data-testid="tree-select-clear"
                >
                  Clear selection
                </button>
              )}
              {flatNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={cn(
                    "hover:bg-accent flex w-full items-center gap-2 px-4 py-2 text-left text-sm",
                    node.id === value && "bg-accent"
                  )}
                  style={{ paddingLeft: `${node.level * 16 + 16}px` }}
                  onClick={() => {
                    onChange(node.id);
                    setIsOpen(false);
                  }}
                  data-testid={`tree-select-option-${node.id}`}
                >
                  {node.icon && <span>{node.icon}</span>}
                  <span className="truncate">{node.name}</span>
                </button>
              ))}
              {flatNodes.length === 0 && (
                <div className="text-muted-foreground px-4 py-2 text-sm">
                  No options available
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
