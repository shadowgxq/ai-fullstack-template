import { House, RefreshCw } from '../../../shared/icons';
import { Button } from '@/shared/ui/button';

export type ErrorPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  reloadLabel?: string;
  homeLabel: string;
};

function reloadPage() {
  window.location.reload();
}

export function ErrorPage({ eyebrow, title, description, reloadLabel, homeLabel }: ErrorPageProps) {
  return (
    <main
      className="bg-background text-foreground grid min-h-dvh place-items-center p-8 max-[480px]:place-items-start max-[480px]:p-6"
      aria-labelledby="app-error-title"
    >
      <div
        className="border-destructive w-[min(100%,640px)] border-t-4 py-12 max-[480px]:pt-8"
        role="alert"
      >
        <p className="text-destructive mt-4 mb-0 font-sans text-sm font-bold">{eyebrow}</p>
        <h1 id="app-error-title" className="mt-4 mb-0 text-3xl leading-tight font-semibold">
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 mb-0 max-w-[56ch] text-base leading-relaxed">
          {description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3 max-[480px]:flex-col max-[480px]:items-stretch">
          {reloadLabel ? (
            <Button type="button" size="lg" onClick={reloadPage}>
              <RefreshCw size={18} aria-hidden="true" />
              {reloadLabel}
            </Button>
          ) : null}
          <Button asChild variant="outline" size="lg">
            <a href="/">
              <House size={18} aria-hidden="true" />
              {homeLabel}
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
