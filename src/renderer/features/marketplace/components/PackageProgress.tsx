import type { CapabilityDistributionProgress } from "../../../../shared/packages/schemas";
import { Button } from "../../../components/ui/button";

const stages = ["resolving", "downloading", "verifying", "installing"] as const;
const labels = {
  resolving: "Resolving package",
  downloading: "Downloading package",
  verifying: "Verifying package",
  installing: "Installing capability",
};

export function PackageProgress({
  progress,
  onCancel,
}: {
  progress: CapabilityDistributionProgress;
  onCancel(): void;
}) {
  const current = stages.indexOf(progress.stage as (typeof stages)[number]);
  return (
    <section
      aria-label="Package progress"
      aria-live="polite"
      className="border-y border-border py-4 motion-reduce:transition-none motion-reduce:animate-none"
    >
      <ol className="grid gap-2 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <li
            key={stage}
            aria-current={stage === progress.stage ? "step" : undefined}
            className={`${index <= current ? "text-foreground" : "text-muted-foreground"} motion-reduce:transition-none motion-reduce:animate-none`}
          >
            <span aria-hidden="true" className="mr-2 font-mono text-[10px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-xs">{labels[stage]}</span>
          </li>
        ))}
      </ol>
      {progress.status === "failed" ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          Package operation failed. Return to the package review before taking
          another action.
        </p>
      ) : null}
      {progress.status === "in_progress" ? (
        <Button className="mt-4" variant="outline" size="sm" onClick={onCancel}>
          Cancel operation
        </Button>
      ) : null}
    </section>
  );
}
