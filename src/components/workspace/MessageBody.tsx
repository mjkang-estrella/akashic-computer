import { Children, isValidElement, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatIcon } from "./ChatIcon";

export function CopyButton({
  text,
  label = "Copy response",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      className="ac-icon-button ac-copy"
      aria-label={copied ? "Copied" : error ? "Copy failed; try again" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setError(false);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setError(true);
        }
      }}
    >
      <ChatIcon name={copied ? "check" : "copy"} />
      {error && (
        <span className="ac-sr-only" role="status">
          Could not copy. Select the text to copy manually.
        </span>
      )}
    </button>
  );
}
function CodeBlock({ children }: { children?: ReactNode }) {
  const code = Children.toArray(children)[0];
  const props = isValidElement<{ children?: ReactNode; className?: string }>(
    code,
  )
    ? code.props
    : undefined;
  const text = String(props?.children ?? "").replace(/\n$/, "");
  const language = props?.className?.replace(/^language-/, "") || "Code";
  return (
    <div className="ac-code-block">
      <div className="ac-code-header">
        <span>{language}</span>
        <CopyButton text={text} label="Copy code" />
      </div>
      <pre>{children}</pre>
    </div>
  );
}
export function MessageBody({ content }: { content: string }) {
  return (
    <div className="ac-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img"]}
        components={{
          pre: CodeBlock,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="ac-table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
