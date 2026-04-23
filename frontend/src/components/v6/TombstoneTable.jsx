import styles from './TombstoneTable.module.css';

export default function TombstoneTable({ rows = [], title, className = '' }) {
  const cls = `${styles.table} ${className}`.trim();
  return (
    <div className={cls}>
      {title && <div className={styles.title}>{title}</div>}
      <dl className={styles.list}>
        {rows.map((row, idx) => (
          <div key={`${row.label}-${idx}`} className={styles.row}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={styles.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
