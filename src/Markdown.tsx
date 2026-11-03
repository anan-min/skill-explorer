// Just enough Markdown for questions: paragraphs, inline `code` and ``` fences.
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, i) =>
        i % 2 ? (
          <code key={i} className="rounded bg-foreground/5 px-1 py-0.5 font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Markdown({ text }: { text: string }) {
  const parts = text.split(/```\w*\n([\s\S]*?)```/);
  return (
    <div className="space-y-3 leading-relaxed">
      {parts.map((part, i) =>
        i % 2 ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-foreground px-4 py-3 font-mono text-sm text-background">
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
