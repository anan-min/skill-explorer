// Just enough Markdown for questions: paragraphs, inline `code` and ``` fences.
export function Inline({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

export function Markdown({ text }: { text: string }) {
  const parts = text.split(/```\w*\n([\s\S]*?)```/);
  return (
    <div className="md">
      {parts.map((part, i) =>
        i % 2 ? (
          <pre key={i}>
            <code>{part.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          part
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((p, j) => (
              <p key={`${i}-${j}`}>
                <Inline text={p.trim()} />
              </p>
            ))
        ),
      )}
    </div>
  );
}
