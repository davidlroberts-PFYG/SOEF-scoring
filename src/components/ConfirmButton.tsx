'use client';

export function ConfirmButton({
  action,
  confirmText,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline"
    >
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
