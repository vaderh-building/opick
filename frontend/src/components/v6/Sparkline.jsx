export default function Sparkline({
  data = [],
  width = 240,
  height = 48,
  stroke = '#1a1a1a',
  strokeWidth = 1,
  fill = 'none',
  ariaLabel = 'Trend sparkline',
  className = '',
}) {
  if (!Array.isArray(data) || data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={stroke} strokeWidth={strokeWidth} opacity="0.3" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = fill !== 'none'
    ? `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`
    : null;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {areaPath && <path d={areaPath} fill={fill} opacity="0.08" />}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
