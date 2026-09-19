import type { RichNode } from "./types";
export default function RichText({ nodes }: { nodes: RichNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (typeof n === "string") return n;
        if (Array.isArray(n)) return <RichText key={i} nodes={n} />;
        const child = <RichText nodes={n.children} />;
        switch (n.tag) {
          case "strong":
            return <strong key={i}>{child}</strong>;
          case "em":
            return <em key={i}>{child}</em>;
          case "br":
            return <br key={i} />;
          case "p":
            return <p key={i}>{child}</p>;
          case "ul":
            return <ul key={i}>{child}</ul>;
          case "li":
            return <li key={i}>{child}</li>;
          case "a":
            return (
              <a
                key={i}
                href={n.href && /^https:\/\//.test(n.href) ? n.href : undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {child}
              </a>
            );
          default:
            return <span key={i}>{child}</span>;
        }
      })}
    </>
  );
}
