import type { AdMetric } from '@lensello/core';
import { formatDay, formatDayLong } from '@/lib/ads/format';

/**
 * A daily bar chart, drawn as inline SVG.
 *
 * No charting library — this is one `<rect>` per day and a baseline, and pulling
 * in a dependency for that would cost more in bundle than it saves in code.
 *
 * Accessibility: the SVG carries `role="img"` and an `aria-label` summarising
 * the series, because a bare `<svg>` full of rectangles conveys nothing to a
 * screen reader. The real fallback is the daily table rendered alongside it on
 * the page, which holds every number this draws.
 */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 120;
const GAP_RATIO = 0.25;

export function DailyChart({
  metrics,
  pick,
  label,
  format,
}: {
  /** Oldest first. */
  metrics: readonly AdMetric[];
  /** The series to draw. */
  pick: (metric: AdMetric) => number;
  /** Human name of the series, for the accessible summary. */
  label: string;
  /** Formats one value, for the summary and per-bar titles. */
  format: (value: number) => string;
}) {
  if (metrics.length === 0) return null;

  const values = metrics.map(pick);
  const max = Math.max(...values);
  const total = values.reduce((sum, value) => sum + value, 0);

  // A flat run of zeroes would divide by zero and, worse, draw full-height bars
  // for days with no activity.
  const scale = max > 0 ? VIEW_HEIGHT / max : 0;

  const slot = VIEW_WIDTH / metrics.length;
  const barWidth = Math.max(1, slot * (1 - GAP_RATIO));

  const peakIndex = values.indexOf(max);
  const peakDay = metrics[peakIndex]?.day;

  const summary =
    `${label} by day, ${metrics.length} ${metrics.length === 1 ? 'day' : 'days'} ` +
    `from ${formatDayLong(metrics[0]!.day)} to ${formatDayLong(metrics[metrics.length - 1]!.day)}. ` +
    `Total ${format(total)}. ` +
    (max > 0 && peakDay
      ? `Highest was ${format(max)} on ${formatDayLong(peakDay)}.`
      : 'No activity recorded in this range.') +
    ' Every value is listed in the daily performance table below.';

  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT + 1}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        className="h-24 w-full"
      >
        {metrics.map((metric, index) => {
          const value = values[index]!;
          const height = value > 0 ? Math.max(1, value * scale) : 0;
          return (
            <rect
              key={metric.day}
              x={index * slot + (slot - barWidth) / 2}
              y={VIEW_HEIGHT - height}
              width={barWidth}
              height={height}
              // currentColor so the bars follow the text colour token and stay
              // legible in both themes without a hardcoded hex.
              fill="currentColor"
              className="text-accent"
            >
              <title>{`${formatDay(metric.day)}: ${format(value)}`}</title>
            </rect>
          );
        })}
        <line
          x1="0"
          y1={VIEW_HEIGHT + 0.5}
          x2={VIEW_WIDTH}
          y2={VIEW_HEIGHT + 0.5}
          stroke="currentColor"
          strokeWidth="1"
          className="text-strong"
        />
      </svg>

      <div className="flex justify-between text-[11px] text-faint">
        <span>{formatDay(metrics[0]!.day)}</span>
        <span className="tabular-nums">peak {format(max)}</span>
        <span>{formatDay(metrics[metrics.length - 1]!.day)}</span>
      </div>
    </figure>
  );
}
