import styles from './PulsingDot.module.css';

export default function PulsingDot({ color = 'var(--green)', size = 7, className = '' }) {
  return (
    <span
      className={`${styles.dot} ${className}`}
      style={{ '--dot-color': color, '--dot-size': `${size}px` }}
      aria-hidden="true"
    />
  );
}
