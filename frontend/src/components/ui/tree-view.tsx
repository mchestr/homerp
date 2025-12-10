"use client";

import { useState } from "react";
import { ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode {
  id: string;
  name: string;
  icon?: string | null;
  children?: TreeNode[];
  itemCount?: number;
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
          "cursor-pointer hover:bg-accent",
          isSelected && "border-l-2 border-primary bg-accent"
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
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
        </button>

        {/* Icon */}
        {node.icon && <span className="text-base">{node.icon}</span>}

        {/* Name */}
        <span className="flex-1 truncate text-sm font-medium">{node.name}</span>

        {/* Item count badge */}
        {typeof node.itemCount === "number" && node.itemCount > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {node.itemCount}
          </span>
        )}

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
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
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
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border bg-background px-4 text-left text-base",
          "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          !selectedNode && "text-muted-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
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
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover shadow-lg">
            {allowClear && value && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
              >
                Clear selection
              </button>
            )}
            {flatNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent",
                  node.id === value && "bg-accent"
                )}
                style={{ paddingLeft: `${node.level * 16 + 16}px` }}
                onClick={() => {
                  onChange(node.id);
                  setIsOpen(false);
                }}
              >
                {node.icon && <span>{node.icon}</span>}
                <span className="truncate">{node.name}</span>
              </button>
            ))}
            {flatNodes.length === 0 && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                No options available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
