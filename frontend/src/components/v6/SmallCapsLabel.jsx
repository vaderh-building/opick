import styles from './SmallCapsLabel.module.css';

export default function SmallCapsLabel({ as = 'span', size = 'sm', children, className = '', ...rest }) {
  const Tag = as;
  const cls = `${styles.label} ${styles[size] || styles.sm} ${className}`.trim();
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
