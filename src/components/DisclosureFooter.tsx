export function DisclosureFooter({ text }: { text: string }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-4 text-xs leading-relaxed text-ink-soft sm:px-6">
        <p>{text}</p>
      </div>
    </footer>
  );
}
