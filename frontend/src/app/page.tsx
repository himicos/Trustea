import Link from "next/link";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-semibold tracking-tight mb-4">
          Trustea
        </h1>
        <p className="text-xl text-text-secondary mb-8">
          The trust fund that runs itself.
        </p>
        <p className="text-text-secondary mb-12 max-w-lg mx-auto">
          Write rules in English. AI enforces them on-chain. Documents encrypted
          on Walrus. Administration that costs $2, not $30,000.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/app" className="btn btn-primary">
            Open App
          </Link>
          <a href="#how" className="btn btn-secondary">
            How it Works
          </a>
        </div>
      </div>
    </div>
  );
}
