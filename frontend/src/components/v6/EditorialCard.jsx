import styles from './EditorialCard.module.css';

export default function EditorialCard({
  columns = 'three',
  bordered = true,
  children,
  className = '',
  as = 'article',
}) {
  const Tag = as;
  const cls = `${styles.card} ${styles[columns] || styles.three} ${bordered ? styles.bordered : ''} ${className}`.trim();
  return <Tag className={cls}>{children}</Tag>;
}

export function EditorialColumn({ weight = 'even', children, className = '' }) {
  const cls = `${styles.col} ${styles[`col_${weight}`] || styles.col_even} ${className}`.trim();
  return <div className={cls}>{children}</div>;
}
