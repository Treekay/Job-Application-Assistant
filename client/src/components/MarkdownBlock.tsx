import type { ReactNode } from "react";

export function MarkdownBlock({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (!listItems.length) return;
    nodes.push(
      <ul className="markdownList" key={`list-${nodes.length}`}>
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{renderInline(item)}</li>)}
      </ul>
    );
    listItems = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();
    if (trimmed.startsWith("### ")) {
      nodes.push(<h4 key={index}>{renderInline(trimmed.slice(4))}</h4>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      nodes.push(<h3 key={index}>{renderInline(trimmed.slice(3))}</h3>);
      return;
    }
    if (trimmed.startsWith("# ")) {
      nodes.push(<h3 key={index}>{renderInline(trimmed.slice(2))}</h3>);
      return;
    }

    nodes.push(<p key={index}>{renderInline(trimmed)}</p>);
  });
  flushList();

  return <div className="markdownBlock">{nodes}</div>;
}

function renderInline(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
