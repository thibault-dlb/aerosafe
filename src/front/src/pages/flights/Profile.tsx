export interface ProfilePoint {
  time: number;
  value: number;
}

export interface ProfileProps {
  title: string;
  unit: string;
  points: ProfilePoint[];
}

const WIDTH = 600;
const HEIGHT = 120;

/** A small line chart of one flight parameter over time (UC-02, step 3). */
export default function Profile({ title, unit, points }: ProfileProps) {
  if (points.length < 2) {
    return (
      <figure>
        <figcaption>{title}</figcaption>
        <p>Not enough values to draw a profile.</p>
      </figure>
    );
  }
  const times = points.map((point) => point.time);
  const values = points.map((point) => point.value);
  const [minTime, maxTime] = [Math.min(...times), Math.max(...times)];
  const [minValue, maxValue] = [Math.min(...values), Math.max(...values)];
  const x = (time: number) => ((time - minTime) / (maxTime - minTime || 1)) * WIDTH;
  const y = (value: number) => HEIGHT - ((value - minValue) / (maxValue - minValue || 1)) * HEIGHT;
  const line = points.map((point) => `${x(point.time).toFixed(1)},${y(point.value).toFixed(1)}`);

  return (
    <figure>
      <figcaption>
        {title}: {minValue.toFixed(0)} to {maxValue.toFixed(0)} {unit}
      </figcaption>
      <svg
        role="img"
        aria-label={`${title} profile`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="none"
      >
        <polyline points={line.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    </figure>
  );
}
