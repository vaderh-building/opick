import styles from './SubjectName.module.css';

export default function SubjectName({ variant = 'medium', as = 'span', children, className = '', ...rest }) {
  const Tag = as;
  const cls = `${styles.name} ${styles[variant] || styles.medium} ${className}`.trim();
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
