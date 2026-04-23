import styles from './HairlineRule.module.css';

export default function HairlineRule({ weight = 'hair', margin = 'md', className = '' }) {
  const cls = `${styles.rule} ${styles[weight] || styles.hair} ${styles[margin] || styles.md} ${className}`.trim();
  return <hr className={cls} aria-hidden="true" />;
}
