export function SiteFooter() {
  return (
    <footer
      className="border-t border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center text-xs text-zinc-600 sm:px-6"
      role="contentinfo"
    >
      © {new Date().getFullYear()} Trolley Stand Schedule — Developed by{" "}
      <a
        href="https://github.com/PhilosTech"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-zinc-800 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-950 hover:decoration-zinc-600"
        aria-label="PhilosTech on GitHub"
      >
        PhilosTech
      </a>
    </footer>
  );
}
