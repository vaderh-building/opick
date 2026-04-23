import styles from './IndexNumber.module.css';

function formatValue(value, decimals) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  const opts = typeof decimals === 'number'
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : (Math.abs(num) >= 1000 ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 });
  return num.toLocaleString('en-US', opts);
}

export default function IndexNumber({
  value,
  variant = 'inline',
  decimals,
  prefix = '',
  suffix = '',
  className = '',
  as = 'span',
  ...rest
}) {
  const Tag = as;
  const cls = `${styles.number} ${styles[variant] || styles.inline} ${className}`.trim();
  return (
    <Tag className={cls} {...rest}>
      {prefix}{formatValue(value, decimals)}{suffix}
    </Tag>
  );
}
